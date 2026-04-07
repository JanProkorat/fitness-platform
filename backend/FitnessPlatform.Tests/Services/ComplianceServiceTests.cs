using FluentAssertions;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Unit tests for <see cref="ComplianceService"/>.
/// </summary>
public class ComplianceServiceTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    /// <summary>
    /// Creates a mocked IMongoContext with plans and meal logs collections.
    /// </summary>
    private static IMongoContext CreateMongo(
        NutritionPlan[]? plans = null,
        List<MealLog>? mealLogs = null)
    {
        var mongo = PlanTestHelpers.CreateMockMongo(plans);

        var mealLogCollection = Substitute.For<IMongoCollection<MealLog>>();
        mealLogCollection.FindAsync(
                Arg.Any<FilterDefinition<MealLog>>(),
                Arg.Any<FindOptions<MealLog, MealLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateMealLogCursor(mealLogs ?? []));
        mongo.MealLogs.Returns(mealLogCollection);

        return mongo;
    }

    private static IAsyncCursor<MealLog> CreateMealLogCursor(List<MealLog> logs)
    {
        var cursor = Substitute.For<IAsyncCursor<MealLog>>();
        var moved = false;
        cursor.Current.Returns(logs);
        cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return logs.Count > 0;
        });
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return logs.Count > 0;
        });
        return cursor;
    }

    [Fact]
    public async Task CalculateComplianceAsync_NoPlan_ReturnsZero()
    {
        // Arrange — no plans in collection
        var mongo = CreateMongo();
        var sut = new ComplianceService(mongo);
        var today = DateTime.UtcNow.Date;

        // Act
        var result = await sut.CalculateComplianceAsync(
            _clientId, today, today, TestContext.Current.CancellationToken);

        // Assert
        result.CompliancePercent.Should().Be(0);
        result.MealsPlanned.Should().Be(0);
        result.MealsLogged.Should().Be(0);
    }

    [Fact]
    public async Task CalculateComplianceAsync_WithPlanAndLogs_ReturnsCorrectPercent()
    {
        // Arrange — plan with 1 week, day 1 has 3 meals, published today
        var today = DateTime.UtcNow.Date;
        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active,
            weekCount: 1);
        plan.DatePublished = today;

        // Add 3 meals to day 1 (DayOfWeek=1, index 0 after cycling)
        plan.Weeks[0].Days[0].Meals =
        [
            PlanTestHelpers.CreateMeal(kind: MealKind.Breakfast),
            PlanTestHelpers.CreateMeal(kind: MealKind.Lunch),
            PlanTestHelpers.CreateMeal(kind: MealKind.Dinner)
        ];

        // 2 meal logs for today
        var logs = new List<MealLog>
        {
            new() { ClientId = _clientId, EatenAt = today.AddHours(8), FoodsEaten = [] },
            new() { ClientId = _clientId, EatenAt = today.AddHours(12), FoodsEaten = [] }
        };

        var mongo = CreateMongo([plan], logs);
        var sut = new ComplianceService(mongo);

        // Act
        var result = await sut.CalculateComplianceAsync(
            _clientId, today, today, TestContext.Current.CancellationToken);

        // Assert — 2/3 * 100 = 66.7
        result.MealsPlanned.Should().Be(3);
        result.MealsLogged.Should().Be(2);
        result.CompliancePercent.Should().Be(66.7m);
    }

    [Fact]
    public async Task CalculateStreakAsync_NoPlan_ReturnsZero()
    {
        // Arrange — no plans
        var mongo = CreateMongo();
        var sut = new ComplianceService(mongo);

        // Act
        var streak = await sut.CalculateStreakAsync(
            _clientId, TestContext.Current.CancellationToken);

        // Assert
        streak.Should().Be(0);
    }

    [Fact]
    public async Task CalculateAverageMacrosAsync_NoLogs_ReturnsZeros()
    {
        // Arrange — empty meal logs
        var mongo = CreateMongo();
        var sut = new ComplianceService(mongo);
        var today = DateTime.UtcNow.Date;

        // Act
        var result = await sut.CalculateAverageMacrosAsync(
            _clientId, today, today, TestContext.Current.CancellationToken);

        // Assert
        result.Kcal.Should().Be(0);
        result.Protein.Should().Be(0);
        result.Carbs.Should().Be(0);
        result.Fat.Should().Be(0);
    }

    [Fact]
    public async Task CalculateAverageMacrosAsync_WithLogs_ReturnsAverages()
    {
        // Arrange — 2 logs on the same day with known foods
        var today = DateTime.UtcNow.Date;

        var food1 = PlanTestHelpers.CreateMealFood(
            foodName: "Chicken", amountGrams: 200, kcal: 165, protein: 31, carbs: 0, fat: 3.6m);
        var food2 = PlanTestHelpers.CreateMealFood(
            foodName: "Rice", amountGrams: 150, kcal: 130, protein: 2.7m, carbs: 28, fat: 0.3m);

        var logs = new List<MealLog>
        {
            new()
            {
                ClientId = _clientId,
                EatenAt = today.AddHours(12),
                FoodsEaten = [food1]
            },
            new()
            {
                ClientId = _clientId,
                EatenAt = today.AddHours(18),
                FoodsEaten = [food2]
            }
        };

        var mongo = CreateMongo(mealLogs: logs);
        var sut = new ComplianceService(mongo);

        // Act
        var result = await sut.CalculateAverageMacrosAsync(
            _clientId, today, today, TestContext.Current.CancellationToken);

        // Assert — both logs are on the same day, so 1 day of averages
        // Food1: 200/100 * 165 = 330 kcal, 200/100 * 31 = 62 protein, 0 carbs, 200/100 * 3.6 = 7.2 fat
        // Food2: 150/100 * 130 = 195 kcal, 150/100 * 2.7 = 4.05 protein, 150/100 * 28 = 42 carbs, 150/100 * 0.3 = 0.45 fat
        // Day total: 525 kcal, 66.05 protein, 42 carbs, 7.65 fat
        // Average (1 day): same as total, rounded to 1 decimal (Math.Round uses banker's rounding)
        result.Kcal.Should().Be(525.0m);
        result.Protein.Should().Be(66.0m); // 66.05 rounds to 66.0 (banker's rounding)
        result.Carbs.Should().Be(42.0m);
        result.Fat.Should().Be(7.6m); // 7.65 rounds to 7.6 (banker's rounding)
    }
}
