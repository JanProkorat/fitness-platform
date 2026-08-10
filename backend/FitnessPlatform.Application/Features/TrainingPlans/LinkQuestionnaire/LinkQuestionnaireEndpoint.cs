using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.TrainingPlans.GetTrainingPlan;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.TrainingPlans.LinkQuestionnaire;

/// <summary>
/// Links or unlinks a questionnaire response to/from a training plan.
/// Validates that the response belongs to the same professional and client.
/// </summary>
public class LinkTrainingQuestionnaireEndpoint(
    IMongoContext mongo,
    IApplicationDbContext db,
    PlanConcurrencyGuard guard,
    ProfessionalAuthHelper authHelper)
    : Endpoint<LinkTrainingQuestionnaireRequest, GetTrainingPlanResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/training/plans/{PlanId}/link-questionnaire");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Link questionnaire to training plan";
            s.Description = "Links a submitted questionnaire response to a plan, or unlinks by passing null.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(LinkTrainingQuestionnaireRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        var lookupFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                     & Builders<TrainingPlan>.Filter.Eq(p => p.TrainerId, trainerId);
        var replaceFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                            & Builders<TrainingPlan>.Filter.Eq(p => p.Version, req.Version);

        var guardResult = await guard.ReplaceWithVersionGuardAsync(
            mongo.TrainingPlans,
            lookupFilter,
            replaceFilter,
            req.Version,
            p => p.Version,
            async (plan, mutateCt) =>
            {
                // The lookup filter proved authorship, which is permanent. Access is not —
                // require the caller's link to the plan's client to still grant training access.
                var hasAccess = await authHelper.HasPlanAccessForClientUserAsync(
                    trainerId, plan.ClientId, requireTrainingPlanAccess: true, mutateCt);

                if (!hasAccess)
                {
                    await Send.NotFoundAsync(mutateCt);
                    return false;
                }

                // Only draft or active plans can have their questionnaire link changed
                if (plan.Status is TrainingPlanStatus.Completed or TrainingPlanStatus.Archived)
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
                                       && r.ProfessionalId == trainerId
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
        await Send.OkAsync(GetTrainingPlanResponse.FromDocument(plan, clientPublicId), ct);
    }
}
