using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.NutritionPlans.AddFoodToMeal;

/// <summary>
/// Adds a food item to a meal within a nutrition plan, creating a denormalized snapshot.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="macroCalculator">Service for recalculating plan totals.</param>
public class AddFoodToMealEndpoint(IMongoContext mongo, IMacroCalculatorService macroCalculator)
    : Endpoint<AddFoodToMealRequest, MealFood>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/nutrition/plans/{PlanId}/meals/{MealId}/foods");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Add food to meal";
            s.Description = "Adds a food item to the specified meal with a denormalized nutrient snapshot.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(AddFoodToMealRequest req, CancellationToken ct)
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

        // Look up the food document
        var foodFilter = Builders<Food>.Filter.Eq(f => f.ExternalId, req.FoodExternalId);
        using var foodCursor = await mongo.Foods.FindAsync(foodFilter, cancellationToken: ct);
        var food = await foodCursor.FirstOrDefaultAsync(ct);

        if (food is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var mealFood = new MealFood
        {
            FoodExternalId = food.ExternalId,
            FoodName = food.Name,
            NutrientValuePer100Grams = new NutrientValue
            {
                Kcal = food.NutrientValue.Kcal,
                Protein = food.NutrientValue.Protein,
                Carbs = food.NutrientValue.Carbs,
                Fat = food.NutrientValue.Fat,
                Fiber = food.NutrientValue.Fiber,
                Sugar = food.NutrientValue.Sugar,
                SaturatedFat = food.NutrientValue.SaturatedFat,
                Salt = food.NutrientValue.Salt
            },
            AmountGrams = req.AmountGrams
        };

        meal.Foods.Add(mealFood);

        macroCalculator.RecalculateTotals(plan);

        plan.Version++;
        plan.DateUpdated = DateTime.UtcNow;
        await mongo.NutritionPlans.ReplaceOneAsync(
            Builders<NutritionPlan>.Filter.Eq(p => p.ExternalId, plan.ExternalId),
            plan, cancellationToken: ct);

        await HttpContext.Response.SendAsync(mealFood, 201, cancellation: ct);
    }
}
