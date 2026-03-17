using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.NutritionPlans.RemoveFoodFromMeal;

/// <summary>
/// Removes a food item from a meal within a nutrition plan.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="macroCalculator">Service for recalculating plan totals.</param>
public class RemoveFoodFromMealEndpoint(IMongoContext mongo, IMacroCalculatorService macroCalculator)
    : Endpoint<RemoveFoodFromMealRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/nutrition/plans/{PlanId}/meals/{MealId}/foods/{FoodExternalId}");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Remove food from meal";
            s.Description = "Removes a food item from the specified meal within a nutrition plan.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(RemoveFoodFromMealRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        var filter = Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, req.PlanId)
            & Builders<NutritionPlan>.Filter.Eq(p => p.NutritionistId, nutritionistId);
        using var cursor = await mongo.NutritionPlans.FindAsync(filter, cancellationToken: ct);
        var plan = await cursor.FirstOrDefaultAsync(ct);

        if (plan is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Flatten search across all weeks/days to find the meal by MealId
        var meal = plan.Weeks
            .SelectMany(w => w.Days)
            .SelectMany(d => d.Meals)
            .FirstOrDefault(m => m.MealId == req.MealId);

        if (meal is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var food = meal.Foods.FirstOrDefault(f => f.FoodExternalId == req.FoodExternalId);

        if (food is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        meal.Foods.Remove(food);

        macroCalculator.RecalculateTotals(plan);

        plan.Version++;
        plan.DateUpdated = DateTime.UtcNow;
        await mongo.NutritionPlans.ReplaceOneAsync(
            Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, plan.ExternalId),
            plan, cancellationToken: ct);

        await Send.NoContentAsync(ct);
    }
}
