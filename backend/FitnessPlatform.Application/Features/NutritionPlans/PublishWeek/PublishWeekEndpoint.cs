using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.NutritionPlans.GetPlan;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.NutritionPlans.PublishWeek;

/// <summary>
/// Publishes a single week of a nutrition plan, making it visible to the client.
/// Archives other active plans for the same client when the first week is published.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class PublishWeekEndpoint(IMongoContext mongo) : Endpoint<PublishWeekRequest, GetPlanResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/nutrition/plans/{PlanId}/weeks/{WeekNumber}/publish");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Publish a week of a nutrition plan";
            s.Description = "Sets the week's status to Published. Archives other active plans for the same client.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(PublishWeekRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);
        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        // Fetch plan
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

        // Check if this is the first published week — if so, archive other active plans
        var hadPublishedWeeks = plan.Weeks.Any(w => w.Status == WeekStatus.Published);
        if (!hadPublishedWeeks)
        {
            var archiveFilter = Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, plan.ClientId)
                                & Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active)
                                & Builders<NutritionPlan>.Filter.Ne(p => p.ExternalId, plan.ExternalId);

            var archiveUpdate = Builders<NutritionPlan>.Update
                .Set(p => p.Status, NutritionPlanStatus.Archived)
                .Set(p => p.DateUpdated, DateTime.UtcNow);

            await mongo.NutritionPlans.UpdateManyAsync(archiveFilter, archiveUpdate, cancellationToken: ct);
        }

        // Publish the week
        week.Status = WeekStatus.Published;
        week.DatePublished = DateTime.UtcNow;
        plan.Status = NutritionPlanStatus.Active;
        plan.DateUpdated = DateTime.UtcNow;
        plan.Version += 1;

        var versionFilter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                            & Builders<NutritionPlan>.Filter.Eq(p => p.Version, req.Version);

        var result = await mongo.NutritionPlans.ReplaceOneAsync(versionFilter, plan, cancellationToken: ct);

        if (result.ModifiedCount == 0)
        {
            await HttpContext.Response.SendAsync(
                new { Error = "Version conflict." }, 409, cancellation: ct);
            return;
        }

        await Send.OkAsync(GetPlanResponse.FromDocument(plan), ct);
    }
}
