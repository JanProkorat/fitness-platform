using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.NutritionPlans.GetPlan;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.NutritionPlans.LinkQuestionnaire;

/// <summary>
/// Links or unlinks a questionnaire response to/from a nutrition plan.
/// Validates that the response belongs to the same professional and client.
/// </summary>
public class LinkQuestionnaireEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    PlanConcurrencyGuard guard,
    ProfessionalAuthHelper authHelper)
    : Endpoint<LinkNutritionQuestionnaireRequest, GetPlanResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/nutrition/plans/{PlanId}/link-questionnaire");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Link questionnaire to nutrition plan";
            s.Description = "Links a submitted questionnaire response to a plan, or unlinks by passing null.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(LinkNutritionQuestionnaireRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        var lookupFilter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                     & Builders<NutritionPlan>.Filter.Eq(p => p.NutritionistId, nutritionistId);
        var replaceFilter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                            & Builders<NutritionPlan>.Filter.Eq(p => p.Version, req.Version);

        var guardResult = await guard.ReplaceWithVersionGuardAsync(
            mongo.NutritionPlans,
            lookupFilter,
            replaceFilter,
            req.Version,
            p => p.Version,
            async (plan, mutateCt) =>
            {
                // The lookup filter proved authorship, which is permanent. Access is not —
                // require the caller's link to the plan's client to still grant nutrition access.
                var hasAccess = await authHelper.HasPlanAccessForClientUserAsync(
                    nutritionistId, plan.ClientId, requireTrainingPlanAccess: false, mutateCt);

                if (!hasAccess)
                {
                    await Send.NotFoundAsync(mutateCt);
                    return false;
                }

                // Only draft or active plans can have their questionnaire link changed
                if (plan.Status is NutritionPlanStatus.Completed or NutritionPlanStatus.Archived)
                {
                    ThrowError("Only draft or active plans can have their questionnaire link changed.");
                    return false;
                }

                // Validate the questionnaire response if linking (not unlinking)
                if (req.QuestionnaireResponseId.HasValue)
                {
                    var responseExists = await db.QuestionnaireResponses
                        .AsNoTracking()
                        .AnyAsync(r => r.PublicId == req.QuestionnaireResponseId.Value
                                       && r.ProfessionalId == nutritionistId
                                       && r.ClientId == plan.ClientId
                                       && r.Status == QuestionnaireResponseStatus.Submitted, mutateCt);

                    if (!responseExists)
                    {
                        ThrowError("QuestionnaireResponseId", "Questionnaire response not found or not submitted.");
                        return false;
                    }
                }

                // Update the link
                plan.QuestionnaireResponseId = req.QuestionnaireResponseId;
                plan.DateUpdated = DateTime.UtcNow;
                plan.Version += 1;

                return true;
            },
            ct);

        switch (guardResult.Outcome)
        {
            case PlanConcurrencyOutcome.NotFound:
                await Send.NotFoundAsync(ct);
                return;
            case PlanConcurrencyOutcome.VersionConflict:
                await this.SendProblemAsync(409, ErrorCodes.PlanVersionConflict,
                    "Version conflict. The plan was modified by another request.", ct);
                return;
            case PlanConcurrencyOutcome.ReplaceConflict:
                await this.SendProblemAsync(409, ErrorCodes.PlanVersionConflict,
                    "Version conflict. The plan was modified concurrently.", ct);
                return;
            case PlanConcurrencyOutcome.HandledByMutator:
                // The link check inside the mutate delegate already wrote its 404.
                return;
        }

        var plan = guardResult.Document!;

        // Response ClientId must stay the client-facing ClientProfile.PublicId (pre-#840
        // contract) — plan.ClientId is the internal ApplicationUser.Id storage key.
        var clientPublicId = await db.ResolveClientPublicIdAsync(plan.ClientId, ct);
        await Send.OkAsync(GetPlanResponse.FromDocument(plan, clientPublicId), ct);
    }
}
