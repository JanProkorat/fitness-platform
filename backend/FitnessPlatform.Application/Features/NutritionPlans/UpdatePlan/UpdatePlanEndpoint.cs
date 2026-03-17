using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.NutritionPlans.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.NutritionPlans.UpdatePlan;

/// <summary>
/// Updates a nutrition plan's name and global settings with optimistic concurrency control.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class UpdatePlanEndpoint(IMongoContext mongo) : Endpoint<UpdatePlanRequest, PlanSummaryDto>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/nutrition/plans/{PlanId}");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Update a nutrition plan";
            s.Description = "Updates the plan name and global settings. Uses optimistic concurrency via version field.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdatePlanRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        var filter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                     & Builders<NutritionPlan>.Filter.Eq(p => p.NutritionistId, nutritionistId)
                     & Builders<NutritionPlan>.Filter.Eq(p => p.Version, req.Version);

        var update = Builders<NutritionPlan>.Update
            .Set(p => p.Name, req.Name)
            .Set(p => p.GlobalSettings, req.GlobalSettings)
            .Set(p => p.DateUpdated, DateTime.UtcNow)
            .Inc(p => p.Version, 1);

        var result = await mongo.NutritionPlans.UpdateOneAsync(filter, update, cancellationToken: ct);

        if (result.ModifiedCount == 0)
        {
            // Check if the plan exists at all for this nutritionist
            var existsFilter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
                               & Builders<NutritionPlan>.Filter.Eq(p => p.NutritionistId, nutritionistId);

            var exists = await mongo.NutritionPlans.CountDocumentsAsync(existsFilter, cancellationToken: ct);

            if (exists == 0)
            {
                await Send.NotFoundAsync(ct);
                return;
            }

            // Plan exists but version mismatch
            await HttpContext.Response.SendAsync(new { Error = "Version conflict. The plan was modified by another request." }, 409, cancellation: ct);
            return;
        }

        // Re-fetch the updated plan
        var fetchFilter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId);
        var cursor = await mongo.NutritionPlans.FindAsync(fetchFilter, cancellationToken: ct);
        var updated = await cursor.FirstOrDefaultAsync(ct);

        await Send.OkAsync(PlanSummaryDto.FromDocument(updated!), ct);
    }
}
