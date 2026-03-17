using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.NutritionPlans.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.NutritionPlans.PublishPlan;

/// <summary>
/// Publishes a Draft nutrition plan, making it Active for the client.
/// Archives any previously active plan for the same client.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class PublishPlanEndpoint(IMongoContext mongo) : Endpoint<PublishPlanRequest, PlanSummaryDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/nutrition/plans/{PlanId}/publish");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Publish a nutrition plan";
            s.Description = "Changes a Draft plan to Active. Any previously active plan for the same client is archived.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(PublishPlanRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        // Find the plan
        var findFilter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId);
        var cursor = await mongo.NutritionPlans.FindAsync(findFilter, cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null || plan.NutritionistId != nutritionistId)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (plan.Status != NutritionPlanStatus.Draft)
        {
            ThrowError("Only Draft plans can be published.");
            return;
        }

        var now = DateTime.UtcNow;

        // Archive any currently active plan for the same client
        var archiveFilter = Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, plan.ClientId)
                            & Builders<NutritionPlan>.Filter.Eq(p => p.NutritionistId, nutritionistId)
                            & Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active);

        var archiveUpdate = Builders<NutritionPlan>.Update
            .Set(p => p.Status, NutritionPlanStatus.Archived)
            .Set(p => p.DateUpdated, now);

        await mongo.NutritionPlans.UpdateManyAsync(archiveFilter, archiveUpdate, cancellationToken: ct);

        // Publish the plan
        var publishFilter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                            & Builders<NutritionPlan>.Filter.Eq(p => p.NutritionistId, nutritionistId);

        var publishUpdate = Builders<NutritionPlan>.Update
            .Set(p => p.Status, NutritionPlanStatus.Active)
            .Set(p => p.DatePublished, now)
            .Set(p => p.DateUpdated, now)
            .Inc(p => p.Version, 1);

        await mongo.NutritionPlans.UpdateOneAsync(publishFilter, publishUpdate, cancellationToken: ct);

        // Re-fetch the updated plan
        var refetchCursor = await mongo.NutritionPlans.FindAsync(findFilter, cancellationToken: ct);
        var updated = await refetchCursor.FirstOrDefaultAsync(ct);

        await Send.OkAsync(PlanSummaryDto.FromDocument(updated!), ct);
    }
}
