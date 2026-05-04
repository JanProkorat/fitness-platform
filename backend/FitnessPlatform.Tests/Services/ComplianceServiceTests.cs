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
            startDate: today.AddDays(-(((int)today.DayOfWeek + 6) % 7)));

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
        var weekStart = today.AddDays(-(((int)today.DayOfWeek + 6) % 7));

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
            startDate: today.AddDays(-(((int)today.DayOfWeek + 6) % 7)));

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
        // Anchor weekStart on yesterday so the week the test arranges always
        // contains yesterday — without this, when today is a Monday, yesterday
        // (Sunday) lands in the previous Monday-starting week and the data ends
        // up in the wrong slot.
        var weekStart = yesterday.AddDays(-(((int)yesterday.DayOfWeek + 6) % 7));

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

        // Assert — yesterday counts (≥1 completed session), so streak is at least 1.
        // Today is incomplete but the "today not over" carve-out prevents breaking.
        streak.Should().BeGreaterThanOrEqualTo(1);
    }

    [Fact]
    public async Task CalculateStreakAsync_CombinedPlan_NutritionLoggedButTrainingMissed_StillCounts()
    {
        // Arrange — nutrition plan with meals logged yesterday, training NOT completed.
        // Under the lenient OR rule the day must still count toward the streak.
        var sessionId = Guid.NewGuid();
        var ex1 = Guid.NewGuid();
        var today = DateTime.UtcNow.Date;
        var yesterday = today.AddDays(-1);
        // Anchor weekStart on yesterday so the week the test arranges always
        // contains yesterday — without this, when today is a Monday, yesterday
        // (Sunday) lands in the previous Monday-starting week and the data ends
        // up in the wrong slot.
        var weekStart = yesterday.AddDays(-(((int)yesterday.DayOfWeek + 6) % 7));

        // Nutrition plan with a meal for yesterday
        var nutritionPlan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active);
        nutritionPlan.StartDate = weekStart;
        nutritionPlan.Weeks[0].Status = WeekStatus.Published;
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

        // Assert — under OR rule: nutrition was logged → yesterday counts.
        // Streak must be ≥ 1 (today may still be skipped via the "not over" carve-out).
        streak.Should().BeGreaterThanOrEqualTo(1);
    }

    [Fact]
    public async Task CalculateStreakAsync_TrainingOnly_OneOfTwoSessionsComplete_CountsTowardStreak()
    {
        // Arrange — training-only client with 2 sessions planned yesterday; only 1 is complete.
        // Under OR the day counts because at least one session is done.
        var sessionId1 = Guid.NewGuid();
        var sessionId2 = Guid.NewGuid();
        var ex1 = Guid.NewGuid();
        var today = DateTime.UtcNow.Date;
        var yesterday = today.AddDays(-1);
        // Anchor weekStart on yesterday so the week the test arranges always
        // contains yesterday — without this, when today is a Monday, yesterday
        // (Sunday) lands in the previous Monday-starting week and the data ends
        // up in the wrong slot.
        var weekStart = yesterday.AddDays(-(((int)yesterday.DayOfWeek + 6) % 7));

        var yesterdayDow = (int)yesterday.DayOfWeek;
        yesterdayDow = yesterdayDow == 0 ? 7 : yesterdayDow;

        // Build a training plan with two sessions on yesterday's DOW
        var trainingPlan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Two-Session Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = weekStart,
            Version = 1,
            DateCreated = weekStart,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = weekStart,
                    Sessions =
                    [
                        new TrainingSession
                        {
                            SessionId = sessionId1,
                            DayOfWeek = yesterdayDow,
                            Name = "Session A",
                            Order = 1,
                            Exercises = [new SessionExercise { ExerciseExternalId = ex1, ExerciseName = "Ex1", Order = 1, Sets = [] }]
                        },
                        new TrainingSession
                        {
                            SessionId = sessionId2,
                            DayOfWeek = yesterdayDow,
                            Name = "Session B",
                            Order = 2,
                            Exercises = [new SessionExercise { ExerciseExternalId = ex1, ExerciseName = "Ex1", Order = 1, Sets = [] }]
                        }
                    ]
                }
            ]
        };

        // Only session 1 is complete; session 2 has no completion record.
        var completion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: sessionId1,
            date: yesterday,
            completedExerciseIds: [ex1]);

        var mongo = CreateMongo(trainingPlan: trainingPlan, completions: [completion]);
        var sut = new ComplianceService(mongo);

        // Act
        var streak = await sut.CalculateStreakAsync(_clientId, TestContext.Current.CancellationToken);

        // Assert — 1 of 2 sessions complete; OR rule means yesterday counts → streak ≥ 1.
        streak.Should().BeGreaterThanOrEqualTo(1);
    }

    [Fact]
    public async Task CalculateStreakAsync_NutritionOnly_PastLastPublishedWeek_ReturnsZero()
    {
        // Scenario from bug 2b:
        //   - nutrition plan StartDate = 2026-04-13, only week 1 published (covers Apr 13–19)
        //   - No training plan
        //   - Today = 2026-04-20 (week 2, no published week)
        //   - No meals logged on Apr 19 or Apr 20
        //   Expected: streak = 0
        //
        // After fix 2a, GetPlannedMealCountForDate returns 0 for Apr 20 (week 2, not published).
        // Apr 20 becomes a "nothing planned" rest-day skip.
        // Apr 19 is in week 1 (published), has planned meals, but 0 logs → dayComplete=false
        // → else { break; } with streak still at 0.
        //
        // We simulate "today = Apr 20" by using a fixed StartDate that puts the
        // current real date in week 2 of a plan with only week 1 published.
        var today = DateTime.UtcNow.Date;
        // StartDate 7 days ago puts today in week 2 of a 1-week plan.
        var startDate = today.AddDays(-7);

        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active,
            weekCount: 1);
        plan.StartDate = startDate;
        plan.DatePublished = startDate;
        plan.Weeks[0].Status = WeekStatus.Published;
        plan.Weeks[0].DatePublished = startDate;

        // Add a meal to every day of week 1 so yesterday (day 7 of week 1) is non-trivially planned
        foreach (var day in plan.Weeks[0].Days)
            day.Meals = [PlanTestHelpers.CreateMeal(kind: MealKind.Breakfast)];

        // No meal logs at all — user did nothing yesterday or today
        var mongo = CreateMongo([plan], mealLogs: []);
        var sut = new ComplianceService(mongo);

        var streak = await sut.CalculateStreakAsync(_clientId, TestContext.Current.CancellationToken);

        streak.Should().Be(0);
    }

    // ── Discipline-aware streak tests ──────────────────────────────────

    [Fact]
    public async Task CalculateStreakAsync_TrainingOnlyDiscipline_IgnoresNutritionSuccess()
    {
        // Arrange — nutrition plan with meals logged every day for 5 days;
        // training plan has sessions each day but no completions ever.
        // With TrainingOnly discipline, nutrition logging must NOT count.
        //
        // Use startDate = 14 days ago so the plan covers today and yesterday
        // regardless of the current day-of-week.
        var sessionId = Guid.NewGuid();
        var ex1 = Guid.NewGuid();
        var today = DateTime.UtcNow.Date;
        var startDate = today.AddDays(-14); // well before yesterday, covers the whole test window

        // Nutrition plan with a meal on every day of every week
        var nutritionPlan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active,
            weekCount: 3);
        nutritionPlan.StartDate = startDate;
        nutritionPlan.DatePublished = startDate;
        foreach (var week in nutritionPlan.Weeks)
        {
            week.Status = WeekStatus.Published;
            week.DatePublished = startDate;
            foreach (var day in week.Days)
                day.Meals = [PlanTestHelpers.CreateMeal(kind: MealKind.Breakfast)];
        }

        // 5 days of meal logs — one per day for the last 5 days
        var mealLogs = new List<MealLog>();
        for (var i = 1; i <= 5; i++)
            mealLogs.Add(new MealLog { ClientId = _clientId, EatenAt = today.AddDays(-i).AddHours(8), FoodsEaten = [] });

        // Training plan with a session on every day — but zero completion records
        var trainingPlan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: sessionId,
            exerciseIds: [ex1],
            startDate: startDate);

        var mongo = CreateMongo(
            nutritionPlans: [nutritionPlan],
            mealLogs: mealLogs,
            trainingPlan: trainingPlan,
            completions: []); // no training completions

        var sut = new ComplianceService(mongo);

        // Act — TrainingOnly means only training sessions count; nutrition logging is irrelevant
        var streak = await sut.CalculateStreakAsync(
            _clientId, ComplianceDiscipline.TrainingOnly, TestContext.Current.CancellationToken);

        // Assert — no sessions completed → streak must be 0
        streak.Should().Be(0);
    }

    [Fact]
    public async Task CalculateStreakAsync_NutritionOnlyDiscipline_IgnoresTrainingSuccess()
    {
        // Arrange — training plan with a completed session yesterday;
        // no meals logged at all.
        // With NutritionOnly discipline, training completions must NOT count.
        //
        // Use startDate = 14 days ago so yesterday is always within the plan window.
        var sessionId = Guid.NewGuid();
        var ex1 = Guid.NewGuid();
        var today = DateTime.UtcNow.Date;
        var yesterday = today.AddDays(-1);
        var startDate = today.AddDays(-14);

        // Nutrition plan with a meal on every day (gives the plan something "planned")
        var nutritionPlan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active,
            weekCount: 3);
        nutritionPlan.StartDate = startDate;
        nutritionPlan.DatePublished = startDate;
        foreach (var week in nutritionPlan.Weeks)
        {
            week.Status = WeekStatus.Published;
            week.DatePublished = startDate;
            foreach (var day in week.Days)
                day.Meals = [PlanTestHelpers.CreateMeal(kind: MealKind.Breakfast)];
        }

        // Training plan with session on every day — yesterday fully completed
        var trainingPlan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: sessionId,
            exerciseIds: [ex1],
            startDate: startDate);

        var completion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: sessionId,
            date: yesterday,
            completedExerciseIds: [ex1]);

        // No meal logs — nutrition side completely empty
        var mongo = CreateMongo(
            nutritionPlans: [nutritionPlan],
            mealLogs: [],
            trainingPlan: trainingPlan,
            completions: [completion]);

        var sut = new ComplianceService(mongo);

        // Act — NutritionOnly means only meal logs count; training completions are irrelevant
        var streak = await sut.CalculateStreakAsync(
            _clientId, ComplianceDiscipline.NutritionOnly, TestContext.Current.CancellationToken);

        // Assert — no meals logged → streak must be 0
        streak.Should().Be(0);
    }

    [Fact]
    public async Task CalculateStreakAsync_BothDiscipline_LenientOrRuleStillApplies()
    {
        // Arrange — combined plan: nutrition logged yesterday but training NOT completed.
        // With Both discipline the lenient OR rule means yesterday should still count.
        //
        // Use startDate = 14 days ago so yesterday is always within the plan window,
        // regardless of the current day-of-week.
        var sessionId = Guid.NewGuid();
        var ex1 = Guid.NewGuid();
        var today = DateTime.UtcNow.Date;
        var yesterday = today.AddDays(-1);
        var startDate = today.AddDays(-14);

        // Nutrition plan with a meal on every day of every week
        var nutritionPlan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active,
            weekCount: 3);
        nutritionPlan.StartDate = startDate;
        nutritionPlan.DatePublished = startDate;
        foreach (var week in nutritionPlan.Weeks)
        {
            week.Status = WeekStatus.Published;
            week.DatePublished = startDate;
            foreach (var day in week.Days)
                day.Meals = [PlanTestHelpers.CreateMeal(kind: MealKind.Breakfast)];
        }

        // One meal log for yesterday only
        var mealLogs = new List<MealLog>
        {
            new() { ClientId = _clientId, EatenAt = yesterday.AddHours(8), FoodsEaten = [] }
        };

        // Training plan with sessions on every day — no completions at all
        var trainingPlan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: sessionId,
            exerciseIds: [ex1],
            startDate: startDate);

        var mongo = CreateMongo(
            nutritionPlans: [nutritionPlan],
            mealLogs: mealLogs,
            trainingPlan: trainingPlan,
            completions: []); // no training completions

        var sut = new ComplianceService(mongo);

        // Act — Both discipline uses the lenient OR rule
        var streak = await sut.CalculateStreakAsync(
            _clientId, ComplianceDiscipline.Both, TestContext.Current.CancellationToken);

        // Assert — nutritionDone=true, trainingDone=false → OR → yesterday counts → streak ≥ 1
        streak.Should().BeGreaterThanOrEqualTo(1);
    }

    [Fact]
    public async Task CalculateStreakAsync_CombinedPlan_NutritionLoggedNoTraining_Counts()
    {
        // Arrange — combined-plan client: nutrition logged yesterday, no training completed.
        // Mirrors the acceptance-criteria example: "nutrition logged but no training complete still counts".
        var sessionId = Guid.NewGuid();
        var ex1 = Guid.NewGuid();
        var today = DateTime.UtcNow.Date;
        var yesterday = today.AddDays(-1);
        // Anchor weekStart on yesterday so the week the test arranges always
        // contains yesterday — without this, when today is a Monday, yesterday
        // (Sunday) lands in the previous Monday-starting week and the data ends
        // up in the wrong slot.
        var weekStart = yesterday.AddDays(-(((int)yesterday.DayOfWeek + 6) % 7));

        var yesterdayDow = (int)yesterday.DayOfWeek;
        yesterdayDow = yesterdayDow == 0 ? 7 : yesterdayDow;

        // Nutrition plan with a meal slot for yesterday
        var nutritionPlan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active);
        nutritionPlan.StartDate = weekStart;
        nutritionPlan.Weeks[0].Status = WeekStatus.Published;
        nutritionPlan.Weeks[0].Days[yesterdayDow - 1].Meals =
            [PlanTestHelpers.CreateMeal(kind: MealKind.Breakfast)];

        var mealLogs = new List<MealLog>
        {
            new() { ClientId = _clientId, EatenAt = yesterday.AddHours(8), FoodsEaten = [] }
        };

        // Training plan with session yesterday — zero completions
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

        // Assert — nutritionDone=true, trainingDone=false → OR → day counts → streak ≥ 1
        streak.Should().BeGreaterThanOrEqualTo(1);
    }
}
