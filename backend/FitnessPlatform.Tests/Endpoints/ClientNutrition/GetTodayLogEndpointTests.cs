using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientNutrition.GetTodayLog;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Tests for <see cref="GetTodayLogEndpoint"/>.
/// </summary>
public class GetTodayLogEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_WithLogs_ReturnsTotals()
    {
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(
            foodName: "Chicken",
            amountGrams: 200,
            kcal: 165,
            protein: 31,
            carbs: 0,
            fat: 3.6m);
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, name: "Lunch", foods: food);

        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active,
            globalSettings: new GlobalNutritionSettings
            {
                DailyKcal = 2000,
                ProteinGrams = 150,
                CarbsGrams = 250,
                FatGrams = 60
            });
        plan.DatePublished = DateTime.UtcNow;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        var logs = new List<MealLog>
        {
            new()
            {
                ClientId = _clientId,
                PlanId = plan.ExternalId,
                MealId = mealId,
                EatenAt = DateTime.UtcNow,
                FoodsEaten = [food]
            }
        };

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        // Mock MealLogs collection
        var mealLogCollection = Substitute.For<IMongoCollection<MealLog>>();
        mealLogCollection.FindAsync(
                Arg.Any<FilterDefinition<MealLog>>(),
                Arg.Any<FindOptions<MealLog, MealLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateMealLogCursor(logs));
        mongo.MealLogs.Returns(mealLogCollection);

        var ep = Factory.Create<GetTodayLogEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.Response.Should().NotBeNull();
        ep.Response.MealsEaten.Should().HaveCount(1);
        ep.Response.MealsEaten[0].MealName.Should().Be("Lunch");

        // 200g chicken at 165kcal/100g = 330 kcal
        ep.Response.TotalConsumed.Kcal.Should().Be(330m);
        // 200g at 31g protein/100g = 62
        ep.Response.TotalConsumed.Protein.Should().Be(62m);

        ep.Response.Remaining.Should().NotBeNull();
        ep.Response.Remaining!.Kcal.Should().Be(2000m - 330m);
    }

    [Fact]
    public async Task HandleAsync_NoLogs_ReturnsEmptyTotals()
    {
        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active);
        plan.DatePublished = DateTime.UtcNow;

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var mealLogCollection = Substitute.For<IMongoCollection<MealLog>>();
        mealLogCollection.FindAsync(
                Arg.Any<FilterDefinition<MealLog>>(),
                Arg.Any<FindOptions<MealLog, MealLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateMealLogCursor([]));
        mongo.MealLogs.Returns(mealLogCollection);

        var ep = Factory.Create<GetTodayLogEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.Response.Should().NotBeNull();
        ep.Response.MealsEaten.Should().BeEmpty();
        ep.Response.TotalConsumed.Kcal.Should().Be(0);
        ep.Response.TotalConsumed.Protein.Should().Be(0);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();

        var ep = Factory.Create<GetTodayLogEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity()),
            mongo);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
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
}
