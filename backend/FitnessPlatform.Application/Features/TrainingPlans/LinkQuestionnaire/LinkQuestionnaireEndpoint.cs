using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.TrainingPlans.GetTrainingPlan;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.TrainingPlans.LinkQuestionnaire;

/// <summary>
/// Links or unlinks a questionnaire response to/from a training plan.
/// Validates that the response belongs to the same professional and client.
/// </summary>
public class LinkTrainingQuestionnaireEndpoint(IMongoContext mongo, IApplicationDbContext db)
    : Endpoint<LinkQuestionnaireRequest, GetTrainingPlanResponse>
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
    public override async Task HandleAsync(LinkQuestionnaireRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        // Fetch plan owned by this trainer
        var filter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                     & Builders<TrainingPlan>.Filter.Eq(p => p.TrainerId, trainerId);

        var cursor = await mongo.TrainingPlans.FindAsync(filter, cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Version check
        if (plan.Version != req.Version)
        {
            await HttpContext.Response.SendAsync(
                new { Error = "Version conflict. The plan was modified by another request." },
                409, cancellation: ct);
            return;
        }

        // Only draft or active plans can have their questionnaire link changed
        if (plan.Status is TrainingPlanStatus.Completed or TrainingPlanStatus.Archived)
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
                               && r.ProfessionalId == trainerId
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

        var versionFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                            & Builders<TrainingPlan>.Filter.Eq(p => p.Version, req.Version);

        var result = await mongo.TrainingPlans.ReplaceOneAsync(versionFilter, plan, cancellationToken: ct);

        if (result.ModifiedCount == 0)
        {
            await HttpContext.Response.SendAsync(
                new { Error = "Version conflict." }, 409, cancellation: ct);
            return;
        }

        await Send.OkAsync(GetTrainingPlanResponse.FromDocument(plan), ct);
    }
}
