using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.NutritionPlans.RemoveFoodFromMeal;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Endpoints;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.NutritionPlans;

/// <summary>
/// Tests for <see cref="RemoveFoodFromMealEndpoint"/>.
/// </summary>
public class RemoveFoodFromMealEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_FoodExists_Removes()
    {
        var planId = Guid.NewGuid();
        var mealId = Guid.NewGuid();
        var foodId = Guid.NewGuid();

        var plan = PlanTestHelpers.CreatePlan(externalId: planId, nutritionistId: _nutritionistId);
        var mealFood = PlanTestHelpers.CreateMealFood(foodExternalId: foodId, foodName: "Rice");
        plan.Weeks[0].Days[0].Meals.Add(PlanTestHelpers.CreateMeal(mealId: mealId, foods: mealFood));
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var calculator = new MacroCalculatorService();

        var ep = Factory.Create<RemoveFoodFromMealEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, (IMacroCalculatorService)calculator);

        await ep.HandleAsync(new RemoveFoodFromMealRequest
        {
            PlanId = planId,
            MealId = mealId,
            FoodExternalId = foodId
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
    }

    [Fact]
    public async Task HandleAsync_FoodNotInMeal_Returns404()
    {
        var planId = Guid.NewGuid();
        var mealId = Guid.NewGuid();

        var plan = PlanTestHelpers.CreatePlan(externalId: planId, nutritionistId: _nutritionistId);
        plan.Weeks[0].Days[0].Meals.Add(PlanTestHelpers.CreateMeal(mealId: mealId));
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var calculator = new MacroCalculatorService();

        var ep = Factory.Create<RemoveFoodFromMealEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, (IMacroCalculatorService)calculator);

        await ep.HandleAsync(new RemoveFoodFromMealRequest
        {
            PlanId = planId,
            MealId = mealId,
            FoodExternalId = Guid.NewGuid()
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
