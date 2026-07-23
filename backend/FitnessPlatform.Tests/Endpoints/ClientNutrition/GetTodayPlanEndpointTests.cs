using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.ClientNutrition.GetTodayPlan;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;

namespace FitnessPlatform.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Tests for <see cref="GetTodayPlanEndpoint"/>.
/// </summary>
public class GetTodayPlanEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    private IApplicationDbContext CreateMockDb() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

    /// <summary>
    /// Returns the Monday of the current week (UTC).
    /// </summary>
    private static DateTime StartOfCurrentWeek()
    {
        var today = DateTime.UtcNow.Date;
        return today.AddDays(-(((int)today.DayOfWeek + 6) % 7));
    }

    [Fact]
    public async Task HandleAsync_ActivePlan_ReturnsTodayMeals()
    {
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Chicken Breast", amountGrams: 200);
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Lunch, foods: food);

        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active,
            weekCount: 1);
        plan.DatePublished = DateTime.UtcNow.Date;
        foreach (var w in plan.Weeks) w.Status = WeekStatus.Published;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var db = CreateMockDb();

        var ep = Factory.Create<GetTodayPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.Response.Should().NotBeNull();
        ep.Response.PlanId.Should().Be(plan.ExternalId);
        ep.Response.WeekNumber.Should().Be(1);
        ep.Response.DayOfWeek.Should().Be(1);
        ep.Response.Meals.Should().ContainSingle(m => m.MealId == mealId);
    }

    [Fact]
    public async Task HandleAsync_NoPlan_Returns404()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();

        var db = CreateMockDb();

        var ep = Factory.Create<GetTodayPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();

        var db = CreateMockDb();

        var ep = Factory.Create<GetTodayPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity()),
            mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_StartDateSet_PastLastPublishedWeek_Returns404()
    {
        // Plan has StartDate 14 days ago with only week 1 published.
        // Today falls in week 3 — no published week matches, so 404 is expected.
        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active,
            weekCount: 2);
        plan.StartDate = DateTime.UtcNow.Date.AddDays(-14);
        plan.DatePublished = plan.StartDate;
        plan.Weeks[0].Status = WeekStatus.Published; // week 1 published
        // week 2 remains Draft — week 3 doesn't exist at all

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var db = CreateMockDb();

        var ep = Factory.Create<GetTodayPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_CyclesWeeks_ReturnsCorrectDay()
    {
        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active,
            weekCount: 1);
        // 1-week plan published 8 days ago => day index = 8 % 7 = 1 => week 0, day index 1 => DayOfWeek=2
        plan.DatePublished = DateTime.UtcNow.Date.AddDays(-8);
        foreach (var w in plan.Weeks) w.Status = WeekStatus.Published;

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var db = CreateMockDb();

        var ep = Factory.Create<GetTodayPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.Response.Should().NotBeNull();
        ep.Response.DayOfWeek.Should().Be(2);
        ep.Response.WeekNumber.Should().Be(1);
    }

    // -------------------------------------------------------------------------
    // #838 — two-phase projected read: byte-equivalence across edge cases.
    // -------------------------------------------------------------------------

    /// <summary>
    /// Regression guard for #780 on the nutrition side (mirrors the training endpoint's
    /// equivalent test): with two non-overlapping Active plans — one whose window has
    /// already elapsed, one whose window contains today — the endpoint must resolve the
    /// in-window plan deterministically and phase-2 hydration must fetch THAT plan's
    /// meals, never the elapsed plan's, regardless of Mongo return order.
    /// </summary>
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task HandleAsync_MultipleActivePlans_ReturnsInWindowPlanMealsRegardlessOfMongoOrder(bool reversedOrder)
    {
        var todayStart = StartOfCurrentWeek();
        var currentPlanMealId = Guid.NewGuid();

        // Past plan: fully elapsed window (ended well before today).
        var pastPlan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active, weekCount: 2, name: "Past Plan");
        pastPlan.StartDate = todayStart.AddDays(-60);
        pastPlan.DatePublished = pastPlan.StartDate;
        foreach (var w in pastPlan.Weeks) w.Status = WeekStatus.Published;

        // Current plan: window contains today (started this week).
        var currentPlan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active, weekCount: 2, name: "Current Plan");
        currentPlan.StartDate = todayStart;
        currentPlan.DatePublished = todayStart;
        foreach (var w in currentPlan.Weeks) w.Status = WeekStatus.Published;
        var food = PlanTestHelpers.CreateMealFood(foodName: "Current Plan Food");
        var meal = PlanTestHelpers.CreateMeal(mealId: currentPlanMealId, kind: MealKind.Lunch, foods: food);
        // StartDate is Monday of this week, so daysSinceStart maps 1:1 to today's ISO
        // weekday (1=Monday) minus 1 — place the meal on TODAY's day, not always Monday.
        var todayDow = (int)DateTime.UtcNow.DayOfWeek;
        todayDow = todayDow == 0 ? 7 : todayDow;
        currentPlan.Weeks[0].Days[todayDow - 1].Meals.Add(meal);

        var plans = reversedOrder
            ? new[] { currentPlan, pastPlan }
            : new[] { pastPlan, currentPlan };

        var mongo = PlanTestHelpers.CreateMockMongo(plans: plans);
        var db = CreateMockDb();

        var ep = Factory.Create<GetTodayPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.PlanId.Should().Be(currentPlan.ExternalId,
            "the resolver must pick the plan whose window contains today, not an arbitrary one");
        ep.Response.Meals.Should().ContainSingle(m => m.MealId == currentPlanMealId,
            "phase-2 hydration must fetch the in-window plan's meals, not the elapsed plan's");
    }

    /// <summary>
    /// A plan whose StartDate is far enough in the future that its window doesn't
    /// contain today must be filtered out by <see cref="PlanWindowResolver.ResolveCurrentPlan{T}"/>
    /// at phase 1 already — same 404 as "no active plan", and phase-2 hydration must
    /// never run for it.
    /// </summary>
    [Fact]
    public async Task HandleAsync_FutureStartDate_Returns404()
    {
        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active, weekCount: 1);
        plan.StartDate = DateTime.UtcNow.Date.AddDays(30);
        plan.DatePublished = plan.StartDate;
        foreach (var w in plan.Weeks) w.Status = WeekStatus.Published;

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var db = CreateMockDb();

        var ep = Factory.Create<GetTodayPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
