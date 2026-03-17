using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.NutritionPlans.GetPlan;

/// <summary>
/// Retrieves a single nutrition plan with full detail (weeks, days, meals, foods).
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class GetPlanEndpoint(IMongoContext mongo) : Endpoint<GetPlanRequest, GetPlanResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/nutrition/plans/{PlanId}");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get a nutrition plan";
            s.Description = "Returns the full nutrition plan with all weeks, days, meals, and foods.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetPlanRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        var filter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId);
        var cursor = await mongo.NutritionPlans.FindAsync(filter, cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null || plan.NutritionistId != nutritionistId)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        await Send.OkAsync(GetPlanResponse.FromDocument(plan), ct);
    }
}
