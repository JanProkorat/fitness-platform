using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.NutritionPlans.DeleteMeal;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Endpoints;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.NutritionPlans;

/// <summary>
/// Tests for <see cref="DeleteMealEndpoint"/>.
/// </summary>
public class DeleteMealEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_MealExists_Deletes()
    {
        var planId = Guid.NewGuid();
        var mealId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(externalId: planId, nutritionistId: _nutritionistId);
        plan.Weeks[0].Days[0].Meals.Add(PlanTestHelpers.CreateMeal(mealId: mealId));
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var calculator = new MacroCalculatorService();

        var ep = Factory.Create<DeleteMealEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, (IMacroCalculatorService)calculator);

        await ep.HandleAsync(new DeleteMealRequest
        {
            PlanId = planId,
            WeekNumber = 1,
            DayOfWeek = 1,
            MealId = mealId
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        await mongo.NutritionPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Any<NutritionPlan>(),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_MealNotFound_Returns404()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(externalId: planId, nutritionistId: _nutritionistId);
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var calculator = new MacroCalculatorService();

        var ep = Factory.Create<DeleteMealEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, (IMacroCalculatorService)calculator);

        await ep.HandleAsync(new DeleteMealRequest
        {
            PlanId = planId,
            WeekNumber = 1,
            DayOfWeek = 1,
            MealId = Guid.NewGuid()
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
