using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.NutritionPlans;

/// <summary>
/// Test helpers for nutrition plan endpoint tests.
/// </summary>
public static class PlanTestHelpers
{
    /// <summary>
    /// Creates a test <see cref="NutritionPlan"/> with configurable properties and default week/day structure.
    /// </summary>
    public static NutritionPlan CreatePlan(
        Guid? externalId = null,
        Guid? clientId = null,
        Guid? nutritionistId = null,
        string name = "Test Plan",
        NutritionPlanStatus status = NutritionPlanStatus.Draft,
        int weekCount = 1,
        int version = 1,
        GlobalNutritionSettings? globalSettings = null)
    {
        return new NutritionPlan
        {
            ExternalId = externalId ?? Guid.NewGuid(),
            ClientId = clientId ?? Guid.NewGuid(),
            NutritionistId = nutritionistId ?? Guid.NewGuid(),
            Name = name,
            Status = status,
            GlobalSettings = globalSettings,
            Weeks = Enumerable.Range(1, weekCount).Select(w => new PlanWeek
            {
                WeekNumber = w,
                Status = WeekStatus.Draft,
                Days = Enumerable.Range(1, 7).Select(d => new PlanDay
                {
                    DayOfWeek = d,
                    Meals = []
                }).ToList()
            }).ToList(),
            Version = version,
            DateCreated = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Creates a <see cref="PlanMeal"/> with optional foods.
    /// </summary>
    public static PlanMeal CreateMeal(
        Guid? mealId = null,
        MealKind kind = MealKind.Breakfast,
        int order = 1,
        string? time = null,
        params MealFood[] foods)
    {
        return new PlanMeal
        {
            MealId = mealId ?? Guid.NewGuid(),
            Kind = kind,
            Order = order,
            Time = time,
            Foods = foods.ToList()
        };
    }

    /// <summary>
    /// Creates a <see cref="MealFood"/> with default nutrient values.
    /// </summary>
    public static MealFood CreateMealFood(
        Guid? foodExternalId = null,
        string foodName = "Test Food",
        decimal amountGrams = 100,
        decimal kcal = 100,
        decimal protein = 10,
        decimal carbs = 10,
        decimal fat = 5)
    {
        return new MealFood
        {
            FoodExternalId = foodExternalId ?? Guid.NewGuid(),
            FoodName = foodName,
            AmountGrams = amountGrams,
            NutrientValuePer100Grams = new NutrientValue
            {
                Kcal = kcal,
                Protein = protein,
                Carbs = carbs,
                Fat = fat
            }
        };
    }

    /// <summary>
    /// Creates a mocked <see cref="IClientLinkAuthorizationService"/> that reports no active link
    /// at all — both the PublicId- and UserId-addressed overloads return <see langword="null"/>,
    /// and the batch overload returns an empty list. Use for a deny-path test that must fail
    /// loudly (403/404, never a silently-granted 200) if the link guard were ever removed.
    /// </summary>
    public static IClientLinkAuthorizationService CreateDenyingLinkAuthorizationService()
    {
        var service = Substitute.For<IClientLinkAuthorizationService>();
        service.GetCapabilitiesByClientPublicIdAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((LinkCapabilities?)null);
        service.GetCapabilitiesByClientUserIdAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((LinkCapabilities?)null);
        service.GetAccessibleClientsAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>(), Arg.Any<LinkCapabilityScope?>())
            .Returns([]);
        return service;
    }

    /// <summary>
    /// Creates a mocked <see cref="IMongoContext"/> with plans (and optional foods / meal logs) collections.
    /// </summary>
    public static IMongoContext CreateMockMongo(
        NutritionPlan[]? plans = null,
        Food[]? foods = null,
        MealLog[]? mealLogs = null)
    {
        var mongo = Substitute.For<IMongoContext>();

        var planCollection = CreateMockCollection(plans?.ToList() ?? []);
        mongo.NutritionPlans.Returns(planCollection);

        var foodCollection = CreateMockFoodCollection(foods?.ToList() ?? []);
        mongo.Foods.Returns(foodCollection);

        var mealLogCollection = CreateMockMealLogCollection(mealLogs?.ToList() ?? []);
        mongo.MealLogs.Returns(mealLogCollection);

        return mongo;
    }

    /// <summary>
    /// Creates a <see cref="MealLog"/> for test purposes.
    /// </summary>
    public static MealLog CreateMealLog(
        Guid planId,
        Guid mealId,
        DateTime logDate,
        DateTime? eatenAt = null,
        Guid? clientId = null)
    {
        return new MealLog
        {
            ClientId = clientId ?? Guid.NewGuid(),
            PlanId = planId,
            MealId = mealId,
            LogDate = logDate,
            EatenAt = eatenAt
        };
    }

    /// <summary>
    /// Creates a mock <see cref="IMongoCollection{NutritionPlan}"/> supporting FindAsync, CountDocumentsAsync, and ReplaceOneAsync.
    /// </summary>
    private static IMongoCollection<NutritionPlan> CreateMockCollection(List<NutritionPlan> plans)
    {
        var collection = Substitute.For<IMongoCollection<NutritionPlan>>();

        collection.FindAsync(
                Arg.Any<FilterDefinition<NutritionPlan>>(),
                Arg.Any<FindOptions<NutritionPlan, NutritionPlan>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateCursor(plans));

        collection.CountDocumentsAsync(
                Arg.Any<FilterDefinition<NutritionPlan>>(),
                Arg.Any<CountOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(plans.Count);

        // ReplaceOneAsync returns acknowledged result
        var replaceResult = Substitute.For<ReplaceOneResult>();
        replaceResult.ModifiedCount.Returns(1);
        collection.ReplaceOneAsync(
                Arg.Any<FilterDefinition<NutritionPlan>>(),
                Arg.Any<NutritionPlan>(),
                Arg.Any<ReplaceOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(replaceResult);

        // UpdateOneAsync
        var updateResult = Substitute.For<UpdateResult>();
        updateResult.ModifiedCount.Returns(1);
        collection.UpdateOneAsync(
                Arg.Any<FilterDefinition<NutritionPlan>>(),
                Arg.Any<UpdateDefinition<NutritionPlan>>(),
                Arg.Any<UpdateOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(updateResult);

        // UpdateManyAsync
        collection.UpdateManyAsync(
                Arg.Any<FilterDefinition<NutritionPlan>>(),
                Arg.Any<UpdateDefinition<NutritionPlan>>(),
                Arg.Any<UpdateOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(updateResult);

        // FindOneAndUpdateAsync — default stub for the #839 targeted-$set publish path.
        // Tests exercising the write path (success / genuine-race-conflict) override this with an
        // explicit .Returns() for the specific plan/null they expect; this default is only reached
        // by tests that never get past validation (e.g. NotFound, AlreadyPublished).
        collection.FindOneAndUpdateAsync(
                Arg.Any<FilterDefinition<NutritionPlan>>(),
                Arg.Any<UpdateDefinition<NutritionPlan>>(),
                Arg.Any<FindOneAndUpdateOptions<NutritionPlan, NutritionPlan>>(),
                Arg.Any<CancellationToken>())
            .Returns((NutritionPlan?)plans.FirstOrDefault());

        return collection;
    }

    /// <summary>
    /// Creates a mock food collection for food lookups.
    /// </summary>
    public static IMongoCollection<Food> CreateMockFoodCollection(List<Food> foods)
    {
        var collection = Substitute.For<IMongoCollection<Food>>();

        collection.FindAsync(
                Arg.Any<FilterDefinition<Food>>(),
                Arg.Any<FindOptions<Food, Food>>(),
                Arg.Any<CancellationToken>())
            .Returns(ci => CreateFoodCursor(foods));

        return collection;
    }

    private static IAsyncCursor<NutritionPlan> CreateCursor(List<NutritionPlan> plans)
    {
        var cursor = Substitute.For<IAsyncCursor<NutritionPlan>>();
        var moved = false;
        cursor.Current.Returns(plans);
        cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return plans.Count > 0;
        });
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return plans.Count > 0;
        });
        return cursor;
    }

    private static IAsyncCursor<Food> CreateFoodCursor(List<Food> foods)
    {
        var cursor = Substitute.For<IAsyncCursor<Food>>();
        var moved = false;
        cursor.Current.Returns(foods);
        cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return foods.Count > 0;
        });
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return foods.Count > 0;
        });
        return cursor;
    }

    /// <summary>
    /// Creates a mock <see cref="IMongoCollection{MealLog}"/> supporting FindAsync (with and without projection).
    /// </summary>
    private static IMongoCollection<MealLog> CreateMockMealLogCollection(List<MealLog> mealLogs)
    {
        var collection = Substitute.For<IMongoCollection<MealLog>>();

        collection.FindAsync(
                Arg.Any<FilterDefinition<MealLog>>(),
                Arg.Any<FindOptions<MealLog, MealLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateMealLogCursor(mealLogs));

        // Also mock the projected FindAsync used by Find().Project(m => m.MealId).ToListAsync()
        // which dispatches FindAsync<MealLog, Guid> internally.
        var mealIds = mealLogs.Select(m => m.MealId).ToList();
        var guidCursor = Substitute.For<IAsyncCursor<Guid>>();
        var guidMoved = false;
        guidCursor.Current.Returns(mealIds);
        guidCursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (guidMoved) return false;
            guidMoved = true;
            return mealIds.Count > 0;
        });
        guidCursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (guidMoved) return false;
            guidMoved = true;
            return mealIds.Count > 0;
        });
        collection.FindAsync(
                Arg.Any<FilterDefinition<MealLog>>(),
                Arg.Any<FindOptions<MealLog, Guid>>(),
                Arg.Any<CancellationToken>())
            .Returns(guidCursor);

        return collection;
    }

    private static IAsyncCursor<MealLog> CreateMealLogCursor(List<MealLog> mealLogs)
    {
        var cursor = Substitute.For<IAsyncCursor<MealLog>>();
        var moved = false;
        cursor.Current.Returns(mealLogs);
        cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return mealLogs.Count > 0;
        });
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return mealLogs.Count > 0;
        });
        return cursor;
    }
}
