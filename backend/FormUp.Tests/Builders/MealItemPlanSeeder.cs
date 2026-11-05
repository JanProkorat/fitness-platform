using FormUp.Application.Domain.Documents;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Infrastructure.Data.MongoDb;
using FormUp.Application.Infrastructure.Services;
using FormUp.Tests.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;

namespace FormUp.Tests.Builders;

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

    /// <summary>
    /// Inserts a meal log row for today. Pass <paramref name="eatenAt"/> to mark the row eaten; leave it
    /// null (with some item ids) for a partly eaten row, or with no ids for a photo-only stub.
    /// </summary>
    public static async Task InsertLogAsync(
        FitnessApiFactory factory, Guid clientUserId, SeededItemMeal seeded, DateTime? eatenAt, params Guid[] eatenItemIds)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();

        await mongo.MealLogs.InsertOneAsync(
            new MealLog
            {
                ClientId = clientUserId,
                PlanId = seeded.PlanId,
                MealId = seeded.MealId,
                LogDate = Today,
                EatenAt = eatenAt,
                EatenItemIds = eatenItemIds.ToList(),
            },
            cancellationToken: TestContext.Current.CancellationToken);
    }

    /// <summary>Sets the plan's author, as the coach-facing endpoints scope plans by it.</summary>
    public static Task SetNutritionistAsync(FitnessApiFactory factory, Guid planId, Guid nutritionistId) =>
        MutatePlanAsync(factory, planId, plan => plan.NutritionistId = nutritionistId);

    /// <summary>Adds a food to the meal on every day, as a coach editing the plan would. Returns its item id.</summary>
    public static async Task<Guid> AddFoodAsync(FitnessApiFactory factory, SeededItemMeal seeded)
    {
        var itemId = Guid.NewGuid();

        await MutatePlanAsync(factory, seeded.PlanId, plan => ForEachMeal(plan, seeded.MealId, meal =>
            meal.Foods.Add(new MealFood
            {
                ItemId = itemId,
                FoodExternalId = Guid.NewGuid(),
                FoodName = "Egg",
                NutrientValuePer100Grams = new NutrientValue { Kcal = 100 },
                AmountGrams = 100,
            })));

        return itemId;
    }

    /// <summary>Removes one item from the meal on every day, as a coach editing the plan would.</summary>
    public static Task RemoveItemAsync(FitnessApiFactory factory, SeededItemMeal seeded, Guid itemId) =>
        MutatePlanAsync(factory, seeded.PlanId, plan => ForEachMeal(plan, seeded.MealId, meal =>
        {
            meal.Foods.RemoveAll(food => food.ItemId == itemId);
            meal.Recipes.RemoveAll(recipe => recipe.ItemId == itemId);
        }));

    /// <summary>
    /// Stamps the meal with <paramref name="planVersion"/> as its last change and moves the plan to
    /// that version, as a coach save that edited the meal would.
    /// </summary>
    public static Task StampMealChangeAsync(FitnessApiFactory factory, SeededItemMeal seeded, int planVersion) =>
        MutatePlanAsync(factory, seeded.PlanId, plan =>
        {
            plan.Version = planVersion;
            ForEachMeal(plan, seeded.MealId, meal => meal.ChangedAtPlanVersion = planVersion);
        });

    /// <summary>
    /// Removes the meal from every day and records the removal at <paramref name="planVersion"/>, as a
    /// coach save that deleted it would.
    /// </summary>
    public static Task RemoveMealAsync(FitnessApiFactory factory, SeededItemMeal seeded, int planVersion) =>
        MutatePlanAsync(factory, seeded.PlanId, plan =>
        {
            plan.Version = planVersion;
            plan.RemovedMeals.Add(new RemovedPlanMeal
            {
                MealId = seeded.MealId,
                Kind = MealKind.Lunch,
                WeekNumber = 1,
                DayOfWeek = 1,
                RemovedAtPlanVersion = planVersion,
                RemovedAt = DateTime.UtcNow,
            });

            foreach (var day in plan.Weeks.SelectMany(week => week.Days))
            {
                day.Meals.RemoveAll(meal => meal.MealId == seeded.MealId);
            }
        });

    /// <summary>Drops the plan's removed-meal records, as the pruning of a later save would.</summary>
    public static Task ClearRemovedMealsAsync(FitnessApiFactory factory, SeededItemMeal seeded) =>
        MutatePlanAsync(factory, seeded.PlanId, plan => plan.RemovedMeals.Clear());

    /// <summary>Loads the stored plan.</summary>
    public static async Task<NutritionPlan> LoadPlanAsync(FitnessApiFactory factory, SeededItemMeal seeded)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();

        return await mongo.NutritionPlans
            .Find(p => p.ExternalId == seeded.PlanId)
            .FirstAsync(TestContext.Current.CancellationToken);
    }

    private static void ForEachMeal(NutritionPlan plan, Guid mealId, Action<PlanMeal> edit)
    {
        foreach (var meal in plan.Weeks.SelectMany(week => week.Days).SelectMany(day => day.Meals).Where(meal => meal.MealId == mealId))
        {
            edit(meal);
        }
    }

    private static async Task MutatePlanAsync(FitnessApiFactory factory, Guid planId, Action<NutritionPlan> edit)
    {
        using var scope = factory.Services.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        var plan = await mongo.NutritionPlans
            .Find(p => p.ExternalId == planId)
            .FirstAsync(TestContext.Current.CancellationToken);

        edit(plan);

        await mongo.NutritionPlans.ReplaceOneAsync(
            p => p.ExternalId == planId, plan, cancellationToken: TestContext.Current.CancellationToken);
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
