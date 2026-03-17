using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.NutritionPlans.AddMeal;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Endpoints;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.NutritionPlans;

/// <summary>
/// Tests for <see cref="AddMealEndpoint"/>.
/// </summary>
public class AddMealEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ValidRequest_AddsMeal()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(externalId: planId, nutritionistId: _nutritionistId);
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var calculator = new MacroCalculatorService();

        var ep = Factory.Create<AddMealEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, (IMacroCalculatorService)calculator);

        await ep.HandleAsync(new AddMealRequest
        {
            PlanId = planId,
            WeekNumber = 1,
            DayOfWeek = 1,
            Name = "Breakfast",
            Order = 1,
            Time = "08:00"
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.NutritionPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<NutritionPlan>>(),
            Arg.Any<NutritionPlan>(),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_PlanNotFound_Returns404()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();
        var calculator = new MacroCalculatorService();

        var ep = Factory.Create<AddMealEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, (IMacroCalculatorService)calculator);

        await ep.HandleAsync(new AddMealRequest
        {
            PlanId = Guid.NewGuid(),
            WeekNumber = 1,
            DayOfWeek = 1,
            Name = "Breakfast",
            Order = 1
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
