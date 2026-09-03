using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientNutrition.LogMealEaten;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Tests for <see cref="LogMealEatenEndpoint"/>.
/// </summary>
public class LogMealEatenEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    private IApplicationDbContext CreateMockDb() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

    [Fact]
    public async Task HandleAsync_ValidMeal_LogsMeal()
    {
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Rice");
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Dinner, foods: food);

        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active);
        plan.DatePublished = DateTime.UtcNow;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        // Mock MealLogs collection for InsertOneAsync
        var mealLogCollection = Substitute.For<IMongoCollection<MealLog>>();
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<LogMealEatenEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, Substitute.For<IRealtimeNotifier>(), TimeProvider.System);

        await ep.HandleAsync(
            new LogMealEatenRequest { MealId = mealId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mealLogCollection.Received(1).InsertOneAsync(
            Arg.Is<MealLog>(log =>
                log.ClientId == _clientId &&
                log.MealId == mealId &&
                log.FoodsEaten.Count == 1),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_WithPhotosAndNote_PersistsToMealLog()
    {
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Oats");
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Breakfast, foods: food);

        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active);
        plan.DatePublished = DateTime.UtcNow;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var mealLogCollection = Substitute.For<IMongoCollection<MealLog>>();
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<LogMealEatenEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, Substitute.For<IRealtimeNotifier>(), TimeProvider.System);

        var photoUrls = new List<string>
        {
            "https://minio.local/bucket/photo1.jpg",
            "https://minio.local/bucket/photo2.jpg"
        };
        const string note = "Felt great after this meal!";

        await ep.HandleAsync(
            new LogMealEatenRequest { MealId = mealId, PhotoBlobUrls = photoUrls, Note = note },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mealLogCollection.Received(1).InsertOneAsync(
            Arg.Is<MealLog>(log =>
                log.ClientId == _clientId &&
                log.MealId == mealId &&
                log.Photos.Count == 2 &&
                log.Photos[0].BlobUrl == photoUrls[0] &&
                log.Photos[1].BlobUrl == photoUrls[1] &&
                log.Note == note),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_WithoutPhotosOrNote_PersistsEmptyPhotosAndNullNote()
    {
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Eggs");
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Breakfast, foods: food);

        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active);
        plan.DatePublished = DateTime.UtcNow;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var mealLogCollection = Substitute.For<IMongoCollection<MealLog>>();
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<LogMealEatenEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, Substitute.For<IRealtimeNotifier>(), TimeProvider.System);

        // No PhotoBlobUrls or Note supplied — original quick-log path
        await ep.HandleAsync(
            new LogMealEatenRequest { MealId = mealId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mealLogCollection.Received(1).InsertOneAsync(
            Arg.Is<MealLog>(log =>
                log.ClientId == _clientId &&
                log.MealId == mealId &&
                log.Photos.Count == 0 &&
                log.Note == null),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_MealNotInPlan_Returns404()
    {
        var plan = PlanTestHelpers.CreatePlan(
            clientId: _clientId,
            status: NutritionPlanStatus.Active);
        plan.DatePublished = DateTime.UtcNow;

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var mealLogCollection = Substitute.For<IMongoCollection<MealLog>>();
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<LogMealEatenEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, Substitute.For<IRealtimeNotifier>(), TimeProvider.System);

        await ep.HandleAsync(
            new LogMealEatenRequest { MealId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoPlan_Returns404()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();
        var mealLogCollection = Substitute.For<IMongoCollection<MealLog>>();
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<LogMealEatenEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, Substitute.For<IRealtimeNotifier>(), TimeProvider.System);

        await ep.HandleAsync(
            new LogMealEatenRequest { MealId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var mongo = PlanTestHelpers.CreateMockMongo();

        var db = CreateMockDb();

        var ep = Factory.Create<LogMealEatenEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity()),
            mongo, db, Substitute.For<IRealtimeNotifier>(), TimeProvider.System);

        await ep.HandleAsync(
            new LogMealEatenRequest { MealId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }
}
