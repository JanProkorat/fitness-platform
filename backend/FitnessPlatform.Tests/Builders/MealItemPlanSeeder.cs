using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;

namespace FitnessPlatform.Tests.Builders;

/// <summary>
/// The ids of a seeded plan whose single meal holds two foods and one recipe.
/// </summary>
public record SeededItemMeal(Guid PlanId, Guid MealId, Guid FoodAId, Guid FoodBId, Guid RecipeId);

/// <summary>
/// Seeds an Active plan starting today whose every day carries one meal of two foods (100 and 200 kcal)
/// and one recipe (300 kcal), each with a stable item id, and reads meal log rows back.
/// </summary>
public static class MealItemPlanSeeder
{
    /// <summary>The client-local day the seeded plan starts on.</summary>
    public static DateTime Today => DateTime.UtcNow.Date;

    /// <summary>Inserts the plan for <paramref name="clientUserId"/>.</summary>
    public static async Task<SeededItemMeal> SeedAsync(FitnessApiFactory factory, Guid clientUserId)
    {
        var seeded = new SeededItemMeal(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var foods = new List<MealFood>
        {
            new()
            {
                ItemId = seeded.FoodAId,
                FoodExternalId = Guid.NewGuid(),
                FoodName = "Rice",
                NutrientValuePer100Grams = new NutrientValue { Kcal = 100 },
                AmountGrams = 100,
            },
            new()
            {
                ItemId = seeded.FoodBId,
                FoodExternalId = Guid.NewGuid(),
                FoodName = "Chicken",
                NutrientValuePer100Grams = new NutrientValue { Kcal = 100 },
                AmountGrams = 200,
            },
        };
        var recipes = new List<MealRecipe>
        {
            new()
            {
                ItemId = seeded.RecipeId,
                RecipeId = Guid.NewGuid(),
                RecipeName = "Bowl",
                NutrientValuePerServing = new NutrientValue { Kcal = 300 },
                Servings = 1,
            },
        };
        var totals = new MacroCalculatorService().CalculateMealTotals(foods, recipes);

        var days = Enumerable.Range(1, 7).Select(dayOfWeek => new PlanDay
        {
            DayOfWeek = dayOfWeek,
            Meals =
            [
                new PlanMeal
                {
                    MealId = seeded.MealId,
                    Kind = MealKind.Lunch,
                    Order = 1,
                    Foods = foods,
                    Recipes = recipes,
                    MealTotals = totals,
                },
            ],
        }).ToList();

        var plan = new NutritionPlan
        {
            ExternalId = seeded.PlanId,
            ClientId = clientUserId,
            NutritionistId = Guid.NewGuid(),
            Name = "Item Tick Plan",
            Status = NutritionPlanStatus.Active,
            StartDate = Today,
            Version = 1,
            DateCreated = Today,
            Weeks = [new PlanWeek { WeekNumber = 1, Status = WeekStatus.Published, DatePublished = Today, Days = days }],
        };

        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        await mongo.NutritionPlans.InsertOneAsync(plan, cancellationToken: TestContext.Current.CancellationToken);

        return seeded;
    }

    /// <summary>Loads every meal log row of the client for the meal.</summary>
    public static async Task<List<MealLog>> LoadLogsAsync(FitnessApiFactory factory, Guid clientUserId, Guid mealId)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();

        return await mongo.MealLogs
            .Find(l => l.ClientId == clientUserId && l.MealId == mealId)
            .ToListAsync(TestContext.Current.CancellationToken);
    }
}
