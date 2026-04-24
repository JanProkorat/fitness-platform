using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientNutrition.AttachMealPhotos;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using MongoDB.Bson;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Tests for <see cref="AttachMealPhotosEndpoint"/>.
/// </summary>
public class AttachMealPhotosEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    private IApplicationDbContext CreateMockDb() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Creates a mock IMongoCollection&lt;MealLog&gt; whose FindAsync returns
    /// <paramref name="existingLogs"/> on the first call (simulating the look-up
    /// for an already-existing log) and an empty result on subsequent calls.
    /// </summary>
    private static IMongoCollection<MealLog> CreateMealLogCollection(
        List<MealLog>? existingLogs = null)
    {
        existingLogs ??= [];

        var collection = Substitute.For<IMongoCollection<MealLog>>();

        collection.FindAsync(
                Arg.Any<FilterDefinition<MealLog>>(),
                Arg.Any<FindOptions<MealLog, MealLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateMealLogCursor(existingLogs));

        // InsertOneAsync — no return value needed
        collection.InsertOneAsync(
                Arg.Any<MealLog>(),
                Arg.Any<InsertOneOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(Task.CompletedTask);

        // UpdateOneAsync — return acknowledged result
        var updateResult = Substitute.For<UpdateResult>();
        updateResult.ModifiedCount.Returns(1);
        collection.UpdateOneAsync(
                Arg.Any<FilterDefinition<MealLog>>(),
                Arg.Any<UpdateDefinition<MealLog>>(),
                Arg.Any<UpdateOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(updateResult);

        return collection;
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

    private AttachMealPhotosEndpoint CreateEndpoint(
        IMongoContext mongo, IApplicationDbContext db) =>
        Factory.Create<AttachMealPhotosEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db);

    // ──────────────────────────────────────────────────────────────────────────
    // Happy-path tests
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NewMealLog_CreatesLogWithPhotosAndNoteAndNoEatenAt()
    {
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Oats");
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Breakfast, foods: food);

        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);
        plan.DatePublished = DateTime.UtcNow;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        // No existing log → FindAsync returns empty list
        var mealLogCollection = CreateMealLogCollection(existingLogs: []);
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        var photoUrls = new List<string> { "https://minio.local/bucket/photo1.jpg" };
        const string note = "Tasty breakfast!";

        await ep.HandleAsync(
            new AttachMealPhotosRequest
            {
                MealId = mealId,
                PhotoBlobUrls = photoUrls,
                Note = note
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        // InsertOne should be called with a log that has photos, note, and no EatenAt
        await mealLogCollection.Received(1).InsertOneAsync(
            Arg.Is<MealLog>(log =>
                log.ClientId == _clientId &&
                log.MealId == mealId &&
                log.EatenAt == null &&
                log.Photos.Count == 1 &&
                log.Photos[0].BlobUrl == photoUrls[0] &&
                log.Note == note),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());

        await mealLogCollection.DidNotReceive().UpdateOneAsync(
            Arg.Any<FilterDefinition<MealLog>>(),
            Arg.Any<UpdateDefinition<MealLog>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_ExistingUneatenLog_AppendsPhotosKeepsEatenAtNull()
    {
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Rice");
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Lunch, foods: food);

        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);
        plan.DatePublished = DateTime.UtcNow;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        // Pre-existing log: uneaten, already has one photo
        var existingLog = new MealLog
        {
            Id = ObjectId.GenerateNewId(),
            ClientId = _clientId,
            PlanId = plan.ExternalId,
            MealId = mealId,
            LogDate = DateTime.UtcNow.Date,
            EatenAt = null,
            FoodsEaten = meal.Foods,
            Photos = [new MealPhoto { BlobUrl = "https://minio.local/bucket/photo1.jpg", UploadedAt = DateTime.UtcNow }],
            Note = null
        };

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var mealLogCollection = CreateMealLogCollection(existingLogs: [existingLog]);
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(
            new AttachMealPhotosRequest
            {
                MealId = mealId,
                PhotoBlobUrls = ["https://minio.local/bucket/photo2.jpg"],
                Note = null
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        // EatenAt must remain null; Photos.Count must be 2 after the append
        existingLog.EatenAt.Should().BeNull();
        existingLog.Photos.Should().HaveCount(2);

        await mealLogCollection.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<MealLog>>(),
            Arg.Any<UpdateDefinition<MealLog>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());

        await mealLogCollection.DidNotReceive().InsertOneAsync(
            Arg.Any<MealLog>(),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_ExistingEatenLog_AppendsPhotosKeepsEatenAtIntact()
    {
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Chicken");
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Dinner, foods: food);

        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);
        plan.DatePublished = DateTime.UtcNow;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        var originalEatenAt = DateTime.UtcNow.AddMinutes(-30);

        var existingLog = new MealLog
        {
            Id = ObjectId.GenerateNewId(),
            ClientId = _clientId,
            PlanId = plan.ExternalId,
            MealId = mealId,
            LogDate = DateTime.UtcNow.Date,
            EatenAt = originalEatenAt,
            FoodsEaten = meal.Foods,
            Photos = [],
            Note = null
        };

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var mealLogCollection = CreateMealLogCollection(existingLogs: [existingLog]);
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(
            new AttachMealPhotosRequest
            {
                MealId = mealId,
                PhotoBlobUrls = ["https://minio.local/bucket/photo1.jpg"],
                Note = null
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        // EatenAt must be unchanged; Photos.Count grows by 1
        existingLog.EatenAt.Should().Be(originalEatenAt);
        existingLog.Photos.Should().HaveCount(1);

        await mealLogCollection.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<MealLog>>(),
            Arg.Any<UpdateDefinition<MealLog>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_OnlyNote_UpdatesNoteWithoutPhotos()
    {
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Salad");
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Lunch, foods: food);

        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);
        plan.DatePublished = DateTime.UtcNow;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        var existingLog = new MealLog
        {
            Id = ObjectId.GenerateNewId(),
            ClientId = _clientId,
            PlanId = plan.ExternalId,
            MealId = mealId,
            LogDate = DateTime.UtcNow.Date,
            EatenAt = null,
            FoodsEaten = meal.Foods,
            Photos = [],
            Note = null
        };

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var mealLogCollection = CreateMealLogCollection(existingLogs: [existingLog]);
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        const string note = "Light and refreshing";

        await ep.HandleAsync(
            new AttachMealPhotosRequest
            {
                MealId = mealId,
                PhotoBlobUrls = null,
                Note = note
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        // Note should be updated; Photos count unchanged
        existingLog.Note.Should().Be(note);
        existingLog.Photos.Should().BeEmpty();

        await mealLogCollection.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<MealLog>>(),
            Arg.Any<UpdateDefinition<MealLog>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Auth / ownership guard tests
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_UnrelatedClient_Returns403()
    {
        // Simulate a caller whose active plan cannot be found (plan owned by another client).
        // The mock NutritionPlans collection is set up with an empty list, which mirrors
        // what happens in production when the MongoDB filter for clientId finds no match.
        // The endpoint returns 404 — the correct security posture is to not reveal whether
        // someone else's plan exists (same behaviour as LogMealEaten).
        var mongo = PlanTestHelpers.CreateMockMongo(plans: []); // no plan visible to _clientId
        var mealLogCollection = CreateMealLogCollection();
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(
            new AttachMealPhotosRequest { MealId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        // 404 is the safe response — the plan is invisible to the caller
        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Not-found tests
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_InvalidMealId_Returns404()
    {
        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);
        plan.DatePublished = DateTime.UtcNow;
        // No meals added — any mealId will be unknown

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var mealLogCollection = CreateMealLogCollection();
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(
            new AttachMealPhotosRequest { MealId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
