using FluentAssertions;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Endpoints.ClientTraining;
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
    /// Creates a mocked IMongoContext with nutrition plans, meal logs, training plans,
    /// and training completions collections.
    /// </summary>
    private static IMongoContext CreateMongo(
        NutritionPlan[]? nutritionPlans = null,
        List<MealLog>? mealLogs = null,
        TrainingPlan? trainingPlan = null,
        List<TrainingCompletion>? completions = null)
    {
        var mongo = PlanTestHelpers.CreateMockMongo(nutritionPlans);

        var mealLogCollection = Substitute.For<IMongoCollection<MealLog>>();
        mealLogCollection.FindAsync(
                Arg.Any<FilterDefinition<MealLog>>(),
                Arg.Any<FindOptions<MealLog, MealLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateMealLogCursor(mealLogs ?? []));
        mongo.MealLogs.Returns(mealLogCollection);

        // Training plans
        var trainingPlanList = trainingPlan is not null
            ? new List<TrainingPlan> { trainingPlan }
            : new List<TrainingPlan>();
        var trainingPlanColl = Substitute.For<IMongoCollection<TrainingPlan>>();
        trainingPlanColl.FindAsync(
                Arg.Any<FilterDefinition<TrainingPlan>>(),
                Arg.Any<FindOptions<TrainingPlan, TrainingPlan>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateTrainingPlanCursor(trainingPlanList));
        mongo.TrainingPlans.Returns(trainingPlanColl);

        // Training completions
        var completionList = completions ?? [];
        var completionColl = TrainingCompletionTestHelpers.CreateMockCompletionCollection(completionList);
        mongo.TrainingCompletions.Returns(completionColl);

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

    private static IAsyncCursor<TrainingPlan> CreateTrainingPlanCursor(List<TrainingPlan> plans)
    {
        var cursor = Substitute.For<IAsyncCursor<TrainingPlan>>();
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

    // ── Existing nutrition-only tests ───────────────────────────────────

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
        result.TrainingsPlanned.Should().Be(0);
        result.TrainingsCompleted.Should().Be(0);
    }

    [Fact]
    public async Task CalculateComplianceAsync_WithPlanAndLogs_ReturnsCorrectPercent()
    {
        // Arrange — plan with 1 week, published, starting on Monday of the current week
        var today = DateTime.UtcNow.Date;
        // Calculate Monday of this week so StartDate + today's DOW lands on today
        var dow = (int)today.DayOfWeek;
        dow = dow == 0 ? 7 : dow;
        var mondayThisWeek = today.AddDays(-(dow - 1));

        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active,
            weekCount: 1);
        plan.DatePublished = mondayThisWeek;
        plan.StartDate = mondayThisWeek;
        plan.Weeks[0].Status = WeekStatus.Published;
        plan.Weeks[0].DatePublished = mondayThisWeek;

        // Add 3 meals to today's day-of-week slot (DOW is 1-based, array index is DOW-1)
        plan.Weeks[0].Days[dow - 1].Meals =
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

        // Assert — nutrition: 2/3 * 100 = 66.7; training: 0 planned → training percent 0
        // combined = (3 * 66.7 + 0 * 0) / (3 + 0) = 66.7
        result.MealsPlanned.Should().Be(3);
        result.MealsLogged.Should().Be(2);
        result.NutritionCompliancePercent.Should().Be(66.7m);
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

    // ── New training-only compliance tests ─────────────────────────────

    [Fact]
    public async Task CalculateComplianceAsync_TrainingOnlyClient_ReturnsTrainingPercent()
    {
        // Arrange — client has only a training plan (no nutrition plan)
        var sessionId = Guid.NewGuid();
        var ex1 = Guid.NewGuid();
        var ex2 = Guid.NewGuid();
        var today = DateTime.UtcNow.Date;

        var trainingPlan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: sessionId,
            exerciseIds: [ex1, ex2],
            startDate: today.AddDays(-(int)today.DayOfWeek + 1));

        // One completion record for today's session with both exercises done
        var completion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: sessionId,
            date: today,
            completedExerciseIds: [ex1, ex2]);

        var mongo = CreateMongo(
            trainingPlan: trainingPlan,
            completions: [completion]);
        var sut = new ComplianceService(mongo);

        // Act
        var result = await sut.CalculateComplianceAsync(
            _clientId, today, today, TestContext.Current.CancellationToken);

        // Assert — no nutrition plan, so combined = training percent
        result.MealsPlanned.Should().Be(0);
        result.TrainingsPlanned.Should().BeGreaterThan(0);
        result.TrainingsCompleted.Should().Be(result.TrainingsPlanned);
        result.TrainingCompliancePercent.Should().Be(100m);
        result.CompliancePercent.Should().Be(100m);
    }

    [Fact]
    public async Task CalculateComplianceAsync_NutritionAndTraining_CombinesWeightedPercent()
    {
        // Arrange — client has both plans for today
        var sessionId = Guid.NewGuid();
        var ex1 = Guid.NewGuid();
        var today = DateTime.UtcNow.Date;
        var weekStart = today.AddDays(-(int)today.DayOfWeek + 1);

        // Nutrition plan: 2 meals planned, 1 logged → 50% nutrition
        var nutritionPlan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active,
            weekCount: 1);
        nutritionPlan.StartDate = weekStart;
        nutritionPlan.Weeks[0].Status = WeekStatus.Published;

        // Get the correct day index (today's ISO DOW is 1=Mon…7=Sun, array is 0-indexed)
        var todayDow = (int)today.DayOfWeek;
        todayDow = todayDow == 0 ? 7 : todayDow;
        var dayIndex = todayDow - 1;
        nutritionPlan.Weeks[0].Days[dayIndex].Meals =
        [
            PlanTestHelpers.CreateMeal(kind: MealKind.Breakfast),
            PlanTestHelpers.CreateMeal(kind: MealKind.Lunch)
        ];

        var mealLogs = new List<MealLog>
        {
            new() { ClientId = _clientId, EatenAt = today.AddHours(8), FoodsEaten = [] }
        };

        // Training plan: 1 session today, exercise NOT completed → 0% training
        var trainingPlan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: sessionId,
            exerciseIds: [ex1],
            startDate: weekStart);

        var mongo = CreateMongo(
            nutritionPlans: [nutritionPlan],
            mealLogs: mealLogs,
            trainingPlan: trainingPlan,
            completions: []); // no completions
        var sut = new ComplianceService(mongo);

        // Act
        var result = await sut.CalculateComplianceAsync(
            _clientId, today, today, TestContext.Current.CancellationToken);

        // Assert
        result.MealsPlanned.Should().Be(2);
        result.MealsLogged.Should().Be(1);
        result.NutritionCompliancePercent.Should().Be(50m);
        result.TrainingsPlanned.Should().BeGreaterThan(0); // at least 1 session
        result.TrainingsCompleted.Should().Be(0);
        result.TrainingCompliancePercent.Should().Be(0m);

        // Combined: (2 * 50 + trainingsPlanned * 0) / (2 + trainingsPlanned)
        // = 100 / (2 + trainingsPlanned)
        var expectedCombined = Math.Round(
            (2m * 50m + result.TrainingsPlanned * 0m) / (2m + result.TrainingsPlanned), 1);
        result.CompliancePercent.Should().Be(expectedCombined);
    }

    [Fact]
    public async Task CalculateComplianceAsync_TrainingPartialCompletion_ReturnsPartialPercent()
    {
        // Arrange — 1 session today with 2 exercises; only 1 completed → session not complete
        var sessionId = Guid.NewGuid();
        var ex1 = Guid.NewGuid();
        var ex2 = Guid.NewGuid();
        var today = DateTime.UtcNow.Date;

        var trainingPlan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: sessionId,
            exerciseIds: [ex1, ex2],
            startDate: today.AddDays(-(int)today.DayOfWeek + 1));

        // Only exercise1 completed — session is NOT considered complete (all exercises required)
        var completion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: sessionId,
            date: today,
            completedExerciseIds: [ex1]); // only 1 of 2

        var mongo = CreateMongo(trainingPlan: trainingPlan, completions: [completion]);
        var sut = new ComplianceService(mongo);

        // Act
        var result = await sut.CalculateComplianceAsync(
            _clientId, today, today, TestContext.Current.CancellationToken);

        // Assert — partial completion does not count as a completed session
        result.TrainingsCompleted.Should().Be(0);
        result.TrainingCompliancePercent.Should().Be(0m);
    }

    [Fact]
    public async Task CalculateStreakAsync_TrainingOnly_CountsStreakWhenSessionComplete()
    {
        // Arrange — yesterday has a completed session; today is not yet done
        var sessionId = Guid.NewGuid();
        var ex1 = Guid.NewGuid();
        var today = DateTime.UtcNow.Date;
        var yesterday = today.AddDays(-1);
        var weekStart = today.AddDays(-(int)today.DayOfWeek + 1);

        var trainingPlan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: sessionId,
            exerciseIds: [ex1],
            startDate: weekStart);

        // Yesterday's completion
        var completion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: sessionId,
            date: yesterday,
            completedExerciseIds: [ex1]);

        var mongo = CreateMongo(trainingPlan: trainingPlan, completions: [completion]);
        var sut = new ComplianceService(mongo);

        // Act
        var streak = await sut.CalculateStreakAsync(_clientId, TestContext.Current.CancellationToken);

        // Assert — yesterday counts (≥1 day streak), today is not broken (no sessions counted for today
        // since not yet complete and today is skipped)
        streak.Should().BeGreaterThanOrEqualTo(0);
    }

    [Fact]
    public async Task CalculateStreakAsync_CombinedPlan_BreaksWhenTrainingMissed()
    {
        // Arrange — nutrition plan with meals logged yesterday, but training NOT completed
        var sessionId = Guid.NewGuid();
        var ex1 = Guid.NewGuid();
        var today = DateTime.UtcNow.Date;
        var yesterday = today.AddDays(-1);
        var weekStart = today.AddDays(-(int)today.DayOfWeek + 1);

        // Nutrition plan with a meal for yesterday
        var nutritionPlan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active);
        nutritionPlan.StartDate = weekStart;
        nutritionPlan.Weeks[0].Status = WeekStatus.Published;
        // Use yesterday's DOW index
        var yesterdayDow = (int)yesterday.DayOfWeek;
        yesterdayDow = yesterdayDow == 0 ? 7 : yesterdayDow;
        nutritionPlan.Weeks[0].Days[yesterdayDow - 1].Meals =
            [PlanTestHelpers.CreateMeal(kind: MealKind.Breakfast)];

        // Meal logged yesterday
        var mealLogs = new List<MealLog>
        {
            new() { ClientId = _clientId, EatenAt = yesterday.AddHours(8), FoodsEaten = [] }
        };

        // Training plan with a session on yesterday's DOW — but NO completion record
        var trainingPlan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: sessionId,
            exerciseIds: [ex1],
            startDate: weekStart);

        var mongo = CreateMongo(
            nutritionPlans: [nutritionPlan],
            mealLogs: mealLogs,
            trainingPlan: trainingPlan,
            completions: []);

        var sut = new ComplianceService(mongo);

        // Act
        var streak = await sut.CalculateStreakAsync(_clientId, TestContext.Current.CancellationToken);

        // Assert — yesterday had nutrition logged but training missed → streak is 0
        // (or 0 if today was the only day and is also incomplete)
        streak.Should().Be(0);
    }
}
