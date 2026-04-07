using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientNutrition.GetShoppingList;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;

namespace FitnessPlatform.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Tests for <see cref="GetShoppingListEndpoint"/>.
/// </summary>
public class GetShoppingListEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    private IApplicationDbContext CreateMockDb() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

    [Fact]
    public async Task HandleAsync_ValidPlan_ReturnsAggregatedFoods()
    {
        var chickenId = Guid.NewGuid();
        var riceId = Guid.NewGuid();
        var chickenFood1 = PlanTestHelpers.CreateMealFood(foodExternalId: chickenId, foodName: "Chicken", amountGrams: 200);
        var chickenFood2 = PlanTestHelpers.CreateMealFood(foodExternalId: chickenId, foodName: "Chicken", amountGrams: 150);
        var riceFood = PlanTestHelpers.CreateMealFood(foodExternalId: riceId, foodName: "Rice", amountGrams: 100);

        var meal1 = PlanTestHelpers.CreateMeal(kind: MealKind.Lunch, order: 1, foods: [chickenFood1, riceFood]);
        var meal2 = PlanTestHelpers.CreateMeal(kind: MealKind.Dinner, order: 2, foods: [chickenFood2]);

        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active,
            weekCount: 1);
        plan.DatePublished = DateTime.UtcNow;
        plan.Weeks[0].Days[0].Meals.Add(meal1);
        plan.Weeks[0].Days[1].Meals.Add(meal2);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var db = CreateMockDb();

        var ep = Factory.Create<GetShoppingListEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId))),
            mongo, db);

        await ep.HandleAsync(
            new GetShoppingListRequest(),
            TestContext.Current.CancellationToken);

        ep.Response.Should().NotBeNull();
        ep.Response.Items.Should().HaveCount(2);

        // Chicken: 200 + 150 = 350, ordered alphabetically
        var chicken = ep.Response.Items.First(i => i.FoodName == "Chicken");
        chicken.TotalAmountGrams.Should().Be(350);

        var rice = ep.Response.Items.First(i => i.FoodName == "Rice");
        rice.TotalAmountGrams.Should().Be(100);
    }

    [Fact]
    public async Task HandleAsync_NoPlan_Returns404()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();

        var db = CreateMockDb();

        var ep = Factory.Create<GetShoppingListEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db);

        await ep.HandleAsync(
            new GetShoppingListRequest(),
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();

        var db = CreateMockDb();

        var ep = Factory.Create<GetShoppingListEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity()),
            mongo, db);

        await ep.HandleAsync(
            new GetShoppingListRequest(),
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}
