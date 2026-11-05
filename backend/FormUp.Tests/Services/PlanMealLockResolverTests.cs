using FluentAssertions;
using FormUp.Application.Domain.Documents;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Domain.Services;
using FormUp.Tests.Endpoints.NutritionPlans;

namespace FormUp.Tests.Services;

/// <summary>
/// Tests for <see cref="PlanMealLockResolver"/>.
/// </summary>
public class PlanMealLockResolverTests
{
    private static readonly DateOnly Today = new(2026, 11, 5);

    private static NutritionPlan PlanWithMeal(DateTime? startDate, int week, int day, out PlanMeal meal)
    {
        var plan = PlanTestHelpers.CreatePlan(weekCount: week);
        plan.StartDate = startDate;
        meal = new PlanMeal
        {
            MealId = Guid.NewGuid(),
            Foods = [new MealFood { ItemId = Guid.NewGuid(), FoodName = "Rice", AmountGrams = 100 }],
        };
        plan.Weeks[week - 1].Days[day - 1].Meals = [meal];

        return plan;
    }

    [Theory]
    [InlineData(1, 1, "2026-11-02")]
    [InlineData(1, 7, "2026-11-08")]
    [InlineData(3, 2, "2026-11-17")]
    public void DayDate_StartDatePlusWeekAndDayOffsets(int week, int day, string expected) =>
        PlanMealLockResolver.DayDate(new DateTime(2026, 11, 2, 0, 0, 0, DateTimeKind.Utc), week, day)
            .Should().Be(DateOnly.Parse(expected));

    [Fact]
    public void Resolve_PlanWithoutStartDate_HasNoPastDays()
    {
        var plan = PlanWithMeal(null, 1, 1, out _);

        var locks = PlanMealLockResolver.Resolve(plan, [], Today);

        locks.Should().ContainSingle().Which.State.Should().Be(MealLockState.Open);
        locks[0].Date.Should().BeNull();
    }

    [Theory]
    [InlineData(1, 3, MealLockState.Missed)]
    [InlineData(1, 4, MealLockState.Open)]
    [InlineData(1, 5, MealLockState.Open)]
    public void Resolve_UneatenMeal_IsMissedOnlyBeforeClientToday(int week, int day, MealLockState expected)
    {
        var plan = PlanWithMeal(new DateTime(2026, 11, 2, 0, 0, 0, DateTimeKind.Utc), week, day, out _);

        var locks = PlanMealLockResolver.Resolve(plan, [], Today);

        locks.Single().State.Should().Be(expected);
        locks.Single().IsLocked.Should().Be(expected != MealLockState.Open);
    }

    [Fact]
    public void Resolve_EatenMealOnPastDay_IsEatenNotMissed_AndCarriesTheSnapshot()
    {
        var plan = PlanWithMeal(new DateTime(2026, 11, 2, 0, 0, 0, DateTimeKind.Utc), 1, 1, out var meal);
        var itemId = meal.Foods[0].ItemId;
        var log = PlanTestHelpers.CreateMealLog(
            plan.ExternalId, meal.MealId, new DateTime(2026, 11, 2, 0, 0, 0, DateTimeKind.Utc),
            eatenAt: new DateTime(2026, 11, 2, 12, 0, 0, DateTimeKind.Utc));
        log.EatenItemIds = [itemId];
        log.EatenSnapshot = [new EatenMealItem { ItemId = itemId, Name = "Rice", Amount = 100, Kcal = 130 }];

        var mealLock = PlanMealLockResolver.Resolve(plan, [log], Today).Single();

        mealLock.State.Should().Be(MealLockState.Eaten);
        mealLock.EatenItemIds.Should().BeEquivalentTo([itemId]);
        mealLock.EatenSnapshot.Should().ContainSingle().Which.Kcal.Should().Be(130);
    }

    [Fact]
    public void ResolveIncludingRemoved_LoggedMealNoLongerInThePlan_IsALockedEatenEntryOnTheLogDay()
    {
        var plan = PlanWithMeal(new DateTime(2026, 11, 2, 0, 0, 0, DateTimeKind.Utc), 1, 1, out var planMeal);
        var removedMealId = Guid.NewGuid();
        var itemId = Guid.NewGuid();
        var logDay = new DateTime(2026, 11, 11, 0, 0, 0, DateTimeKind.Utc);
        var log = PlanTestHelpers.CreateMealLog(
            plan.ExternalId, removedMealId, logDay, eatenAt: logDay.AddHours(12));
        log.MealKind = MealKind.Dinner;
        log.EatenItemIds = [itemId];
        log.EatenSnapshot = [new EatenMealItem { ItemId = itemId, Name = "Soup", Kcal = 200 }];

        var locks = PlanMealLockResolver.ResolveIncludingRemoved(plan, [log], Today);

        locks.Should().HaveCount(2);
        var removed = locks.Single(entry => entry.IsRemovedFromPlan);
        removed.Meal.MealId.Should().Be(removedMealId);
        removed.Meal.Kind.Should().Be(MealKind.Dinner);
        removed.State.Should().Be(MealLockState.Eaten);
        removed.IsLocked.Should().BeTrue();
        removed.Date.Should().Be(new DateOnly(2026, 11, 11));
        (removed.WeekNumber, removed.DayOfWeek).Should().Be((2, 3));
        removed.EatenSnapshot.Should().ContainSingle().Which.Name.Should().Be("Soup");
        locks.Single(entry => !entry.IsRemovedFromPlan).Meal.MealId.Should().Be(planMeal.MealId);
    }

    [Fact]
    public void Resolve_LoggedMealNoLongerInThePlan_IsLeftOutSoTheSavePathNeverSeesIt()
    {
        var plan = PlanWithMeal(new DateTime(2026, 11, 2, 0, 0, 0, DateTimeKind.Utc), 1, 1, out _);
        var log = PlanTestHelpers.CreateMealLog(
            plan.ExternalId, Guid.NewGuid(), new DateTime(2026, 11, 3, 0, 0, 0, DateTimeKind.Utc),
            eatenAt: new DateTime(2026, 11, 3, 12, 0, 0, DateTimeKind.Utc));

        PlanMealLockResolver.Resolve(plan, [log], Today).Should().ContainSingle(entry => !entry.IsRemovedFromPlan);
    }

    [Fact]
    public void Resolve_MealLoggedOnSeveralDays_TakesTheMostEatenState()
    {
        var plan = PlanWithMeal(new DateTime(2026, 11, 2, 0, 0, 0, DateTimeKind.Utc), 1, 5, out var meal);
        meal.Foods.Add(new MealFood { ItemId = Guid.NewGuid(), FoodName = "Beans", AmountGrams = 50 });
        var partly = PlanTestHelpers.CreateMealLog(plan.ExternalId, meal.MealId, new DateTime(2026, 11, 9, 0, 0, 0, DateTimeKind.Utc));
        partly.EatenItemIds = [meal.Foods[0].ItemId];
        var full = PlanTestHelpers.CreateMealLog(
            plan.ExternalId, meal.MealId, new DateTime(2026, 11, 6, 0, 0, 0, DateTimeKind.Utc),
            eatenAt: new DateTime(2026, 11, 6, 12, 0, 0, DateTimeKind.Utc));
        full.EatenItemIds = meal.Foods.Select(food => food.ItemId).ToList();

        var mealLock = PlanMealLockResolver.Resolve(plan, [partly, full], Today).Single();

        mealLock.State.Should().Be(MealLockState.Eaten);
    }
}
