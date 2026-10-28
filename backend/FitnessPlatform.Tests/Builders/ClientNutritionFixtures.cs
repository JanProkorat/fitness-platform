using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Builders;

/// <summary>
/// Writes nutrition plans, recipes and foods straight into the test MongoDB for client-facing
/// nutrition integration tests. All dates assume a client with no stored time zone (UTC).
/// </summary>
public static class ClientNutritionFixtures
{
    /// <summary>
    /// Monday (UTC midnight) of the current week — the start date that makes week 1 "this week".
    /// </summary>
    public static DateTime CurrentWeekMondayUtc()
    {
        var today = DateTime.UtcNow.Date;
        return today.AddDays(-(((int)today.DayOfWeek + 6) % 7));
    }

    /// <summary>
    /// Builds a week with one day holding the given meals.
    /// </summary>
    public static PlanWeek Week(int weekNumber, WeekStatus status, params PlanMeal[] meals) => new()
    {
        WeekNumber = weekNumber,
        Status = status,
        DatePublished = status == WeekStatus.Published ? DateTime.UtcNow : null,
        Days = [new PlanDay { DayOfWeek = 1, Meals = meals.ToList() }],
    };

    /// <summary>
    /// Builds a meal of the given kind holding the given recipes.
    /// </summary>
    public static PlanMeal MealWithRecipes(MealKind kind, params Recipe[] recipes) => new()
    {
        MealId = Guid.NewGuid(),
        Kind = kind,
        Order = 1,
        Recipes = recipes.Select(r => new MealRecipe
        {
            RecipeId = r.ExternalId,
            RecipeName = r.Name,
            NutrientValuePerServing = new NutrientValue { Kcal = 100, Protein = 10 },
        }).ToList(),
    };

    /// <summary>
    /// Builds a meal of the given kind holding the given foods.
    /// </summary>
    public static PlanMeal MealWithFoods(MealKind kind, params MealFood[] foods) => new()
    {
        MealId = Guid.NewGuid(),
        Kind = kind,
        Order = 1,
        Foods = foods.ToList(),
    };

    /// <summary>
    /// Inserts a recipe.
    /// </summary>
    public static async Task<Recipe> InsertRecipeAsync(FitnessApiFactory factory, string? name = null)
    {
        var recipe = new Recipe
        {
            ExternalId = Guid.NewGuid(),
            NutritionistId = Guid.NewGuid(),
            Name = name ?? $"Recipe {Guid.NewGuid():N}",
            Servings = 2,
            PrepTimeMinutes = 15,
            TotalNutrients = new NutrientTotals { Kcal = 800, Protein = 40 },
            MealTypes = ["Lunch"],
            DateCreated = DateTime.UtcNow,
        };

        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        await mongo.Recipes.InsertOneAsync(recipe);
        return recipe;
    }

    /// <summary>
    /// Inserts a food with the given per-100g values.
    /// </summary>
    public static async Task<Food> InsertFoodAsync(
        FitnessApiFactory factory,
        decimal kcalPer100 = 200,
        FoodCategory category = FoodCategory.Other,
        FoodVisibility visibility = FoodVisibility.Public,
        Guid? nutritionistId = null)
    {
        var food = new Food
        {
            ExternalId = Guid.NewGuid(),
            Name = $"Food {Guid.NewGuid():N}",
            NutrientValue = new NutrientValue { Kcal = kcalPer100, Protein = 10, Carbs = 20, Fat = 5, Fiber = 2 },
            Category = category,
            Visibility = visibility,
            NutritionistId = nutritionistId,
            DateCreated = DateTime.UtcNow,
        };

        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        await mongo.Foods.InsertOneAsync(food);
        return food;
    }

    /// <summary>
    /// Inserts a nutrition plan for the client.
    /// </summary>
    public static async Task<NutritionPlan> InsertPlanAsync(
        FitnessApiFactory factory,
        Guid clientId,
        NutritionPlanStatus status,
        DateTime? startDate,
        Guid? nutritionistId = null,
        string? name = null,
        params PlanWeek[] weeks)
    {
        var plan = new NutritionPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientId,
            NutritionistId = nutritionistId ?? Guid.NewGuid(),
            Name = name ?? $"Plan {Guid.NewGuid():N}",
            Status = status,
            StartDate = startDate,
            Weeks = weeks.ToList(),
            Version = 1,
            DateCreated = DateTime.UtcNow,
        };

        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        await mongo.NutritionPlans.InsertOneAsync(plan);
        return plan;
    }
}
