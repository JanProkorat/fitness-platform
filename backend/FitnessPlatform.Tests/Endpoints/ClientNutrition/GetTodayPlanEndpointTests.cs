using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientNutrition.GetTodayPlan;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;

namespace FitnessPlatform.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Tests for <see cref="GetTodayPlanEndpoint"/>.
/// </summary>
public class GetTodayPlanEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ActivePlan_ReturnsTodayMeals()
    {
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Chicken Breast", amountGrams: 200);
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, name: "Lunch", foods: food);

        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active,
            weekCount: 1);
        plan.DatePublished = DateTime.UtcNow.Date;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var ep = Factory.Create<GetTodayPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo);

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

        var ep = Factory.Create<GetTodayPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();

        var ep = Factory.Create<GetTodayPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity()),
            mongo);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
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

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var ep = Factory.Create<GetTodayPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.Response.Should().NotBeNull();
        ep.Response.DayOfWeek.Should().Be(2);
        ep.Response.WeekNumber.Should().Be(1);
    }
}
