using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.NutritionPlans.AddFoodToMeal;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Endpoints;
using FitnessPlatform.Tests.Endpoints.Foods;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.NutritionPlans;

/// <summary>
/// Tests for <see cref="AddFoodToMealEndpoint"/>.
/// </summary>
public class AddFoodToMealEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ValidRequest_AddsFood()
    {
        var planId = Guid.NewGuid();
        var mealId = Guid.NewGuid();
        var foodId = Guid.NewGuid();

        var plan = PlanTestHelpers.CreatePlan(externalId: planId, nutritionistId: _nutritionistId);
        plan.Weeks[0].Days[0].Meals.Add(PlanTestHelpers.CreateMeal(mealId: mealId));

        var food = FoodTestHelpers.CreateFood(externalId: foodId, name: "Chicken Breast", kcal: 165, protein: 31, carbs: 0, fat: 3.6m);
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan], foods: [food]);
        var calculator = new MacroCalculatorService();

        var ep = Factory.Create<AddFoodToMealEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, (IMacroCalculatorService)calculator);

        await ep.HandleAsync(new AddFoodToMealRequest
        {
            PlanId = planId,
            MealId = mealId,
            FoodExternalId = foodId,
            AmountGrams = 200
        }, TestContext.Current.CancellationToken);

        await mongo.NutritionPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Any<NutritionPlan>(),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_FoodNotFound_Returns404()
    {
        var planId = Guid.NewGuid();
        var mealId = Guid.NewGuid();

        var plan = PlanTestHelpers.CreatePlan(externalId: planId, nutritionistId: _nutritionistId);
        plan.Weeks[0].Days[0].Meals.Add(PlanTestHelpers.CreateMeal(mealId: mealId));

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]); // no foods
        var calculator = new MacroCalculatorService();

        var ep = Factory.Create<AddFoodToMealEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, (IMacroCalculatorService)calculator);

        await ep.HandleAsync(new AddFoodToMealRequest
        {
            PlanId = planId,
            MealId = mealId,
            FoodExternalId = Guid.NewGuid(),
            AmountGrams = 100
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
