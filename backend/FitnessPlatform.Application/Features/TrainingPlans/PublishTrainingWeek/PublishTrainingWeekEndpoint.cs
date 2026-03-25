using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.TrainingPlans.GetTrainingPlan;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.TrainingPlans.PublishTrainingWeek;

/// <summary>
/// Publishes a single week of a training plan, making it visible to the client.
/// Archives other active training plans for the same client when the first week is published.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class PublishTrainingWeekEndpoint(IMongoContext mongo) : Endpoint<PublishTrainingWeekRequest, GetTrainingPlanResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/training/plans/{PlanId}/weeks/{WeekNumber}/publish");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Publish a week of a training plan";
            s.Description = "Sets the week's status to Published. Archives other active training plans for the same client.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(PublishTrainingWeekRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        // Fetch plan
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

        var week = plan.Weeks.FirstOrDefault(w => w.WeekNumber == req.WeekNumber);
        if (week is null)
        {
            ThrowError($"Week {req.WeekNumber} not found in plan.");
            return;
        }

        if (week.Status == WeekStatus.Published)
        {
            ThrowError($"Week {req.WeekNumber} is already published.");
            return;
        }

        // Start date must be set before publishing
        if (!plan.StartDate.HasValue)
        {
            ThrowError(ErrorCodes.StartDateRequired, "Start date must be set before publishing a week.");
            return;
        }

        // The target week's Monday must not be in the past
        var weekStartDate = DateOnly.FromDateTime(plan.StartDate.Value.AddDays((req.WeekNumber - 1) * 7));
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (weekStartDate < today)
        {
            ThrowError(ErrorCodes.WeekStartInPast, $"Week {req.WeekNumber} starts on {weekStartDate}, which is in the past.");
            return;
        }

        // Check if this is the first published week — if so, archive other active plans
        var hadPublishedWeeks = plan.Weeks.Any(w => w.Status == WeekStatus.Published);
        if (!hadPublishedWeeks)
        {
            var archiveFilter = Builders<TrainingPlan>.Filter.Eq(p => p.ClientId, plan.ClientId)
                                & Builders<TrainingPlan>.Filter.Eq(p => p.Status, TrainingPlanStatus.Active)
                                & Builders<TrainingPlan>.Filter.Ne(p => p.ExternalId, plan.ExternalId);

            var archiveUpdate = Builders<TrainingPlan>.Update
                .Set(p => p.Status, TrainingPlanStatus.Archived)
                .Set(p => p.DateUpdated, DateTime.UtcNow);

            await mongo.TrainingPlans.UpdateManyAsync(archiveFilter, archiveUpdate, cancellationToken: ct);
        }

        // Publish the week
        week.Status = WeekStatus.Published;
        week.DatePublished = DateTime.UtcNow;
        plan.Status = TrainingPlanStatus.Active;
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
