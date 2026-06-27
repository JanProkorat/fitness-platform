using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.NutritionPlans.GetPlan;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.NutritionPlans.LinkQuestionnaire;

/// <summary>
/// Links or unlinks a questionnaire response to/from a nutrition plan.
/// Validates that the response belongs to the same professional and client.
/// </summary>
public class LinkQuestionnaireEndpoint(IMongoContext mongo, IApplicationDbContext db)
    : Endpoint<LinkQuestionnaireRequest, GetPlanResponse>
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
    public override async Task HandleAsync(LinkQuestionnaireRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        // Fetch plan owned by this nutritionist
        var filter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                     & Builders<NutritionPlan>.Filter.Eq(p => p.NutritionistId, nutritionistId);

        var cursor = await mongo.NutritionPlans.FindAsync(filter, cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Version check
        if (plan.Version != req.Version)
        {
            await this.SendProblemAsync(409, ErrorCodes.PlanVersionConflict,
                "Version conflict. The plan was modified by another request.", ct);
            return;
        }

        // Only draft or active plans can have their questionnaire link changed
        if (plan.Status is NutritionPlanStatus.Completed or NutritionPlanStatus.Archived)
        {
            ThrowError("Only draft or active plans can have their questionnaire link changed.");
            return;
        }

        // Validate the questionnaire response if linking (not unlinking)
        if (req.QuestionnaireResponseId.HasValue)
        {
            var responseExists = await db.QuestionnaireResponses
                .AsNoTracking()
                .AnyAsync(r => r.PublicId == req.QuestionnaireResponseId.Value
                               && r.ProfessionalId == nutritionistId
                               && r.ClientId == plan.ClientId
                               && r.Status == QuestionnaireResponseStatus.Submitted, ct);

            if (!responseExists)
            {
                ThrowError("QuestionnaireResponseId", "Questionnaire response not found or not submitted.");
                return;
            }
        }

        // Update the link
        plan.QuestionnaireResponseId = req.QuestionnaireResponseId;
        plan.DateUpdated = DateTime.UtcNow;
        plan.Version += 1;

        var versionFilter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                            & Builders<NutritionPlan>.Filter.Eq(p => p.Version, req.Version);

        var result = await mongo.NutritionPlans.ReplaceOneAsync(versionFilter, plan, cancellationToken: ct);

        if (result.ModifiedCount == 0)
        {
            await this.SendProblemAsync(409, ErrorCodes.PlanVersionConflict,
                "Version conflict. The plan was modified concurrently.", ct);
            return;
        }

        await Send.OkAsync(GetPlanResponse.FromDocument(plan), ct);
    }
}
