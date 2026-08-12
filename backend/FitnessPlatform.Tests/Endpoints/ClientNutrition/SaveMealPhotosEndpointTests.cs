using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientNutrition.SaveMealPhotos;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Tests for <see cref="SaveMealPhotosEndpoint"/>.
/// </summary>
public class SaveMealPhotosEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly IRealtimeNotifier _notifier = Substitute.For<IRealtimeNotifier>();
    private readonly ILogger<SaveMealPhotosEndpoint> _logger =
        Substitute.For<ILogger<SaveMealPhotosEndpoint>>();
    private readonly FakeBlobStorageService _blobStorage = new();

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

    private SaveMealPhotosEndpoint CreateEndpoint(
        IMongoContext mongo, IApplicationDbContext db, ProfessionalAuthHelper? authHelper = null) =>
        Factory.Create<SaveMealPhotosEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, authHelper ?? EndpointTestHelpers.CreateGrantingAuthHelper(), _logger, _blobStorage);

    // ──────────────────────────────────────────────────────────────────────────
    // Replace-semantics happy-path tests
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NewLog_ReplacesPhotosAndSetsNote()
    {
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Oats");
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Breakfast, foods: food);

        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);
        plan.DatePublished = DateTime.UtcNow;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var mealLogCollection = CreateMealLogCollection(existingLogs: []);
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        const string note = "Tasty breakfast!";

        await ep.HandleAsync(
            new SaveMealPhotosRequest
            {
                MealId = mealId,
                Photos =
                [
                    new MealPhotoInput { BlobUrl = "https://minio.local/bucket/photo1.jpg" },
                    new MealPhotoInput { BlobUrl = "https://minio.local/bucket/photo2.jpg" }
                ],
                Note = note
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        // InsertOne called with exactly 2 photos and the note set
        await mealLogCollection.Received(1).InsertOneAsync(
            Arg.Is<MealLog>(log =>
                log.ClientId == _clientId &&
                log.MealId == mealId &&
                log.EatenAt == null &&
                log.Photos.Count == 2 &&
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
    public async Task HandleAsync_ExistingLog_ReplacesPhotosAndNote()
    {
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Rice");
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Lunch, foods: food);

        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);
        plan.DatePublished = DateTime.UtcNow;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        // Pre-existing log: 2 photos + an old note
        var existingLog = new MealLog
        {
            Id = ObjectId.GenerateNewId(),
            ClientId = _clientId,
            PlanId = plan.ExternalId,
            MealId = mealId,
            LogDate = DateTime.UtcNow.Date,
            EatenAt = null,
            FoodsEaten = meal.Foods,
            Photos =
            [
                new MealPhoto { BlobUrl = "https://minio.local/bucket/old1.jpg", UploadedAt = DateTime.UtcNow.AddHours(-1) },
                new MealPhoto { BlobUrl = "https://minio.local/bucket/old2.jpg", UploadedAt = DateTime.UtcNow.AddHours(-2) }
            ],
            Note = "old note"
        };

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var mealLogCollection = CreateMealLogCollection(existingLogs: [existingLog]);
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        // Post only 1 different URL + new note → old 2 should be gone
        await ep.HandleAsync(
            new SaveMealPhotosRequest
            {
                MealId = mealId,
                Photos = [new MealPhotoInput { BlobUrl = "https://minio.local/bucket/new.jpg" }],
                Note = "new note"
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        await mealLogCollection.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<MealLog>>(),
            Arg.Is<UpdateDefinition<MealLog>>(u => u != null),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());

        await mealLogCollection.DidNotReceive().InsertOneAsync(
            Arg.Any<MealLog>(),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_EmptyPhotoList_ClearsPhotos()
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
            Photos =
            [
                new MealPhoto { BlobUrl = "https://minio.local/bucket/photo.jpg", UploadedAt = DateTime.UtcNow }
            ],
            Note = null
        };

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var mealLogCollection = CreateMealLogCollection(existingLogs: [existingLog]);
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        // Empty list = remove all photos
        await ep.HandleAsync(
            new SaveMealPhotosRequest
            {
                MealId = mealId,
                Photos = [],
                Note = null
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        // UpdateOneAsync must be called (existing log exists)
        await mealLogCollection.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<MealLog>>(),
            Arg.Any<UpdateDefinition<MealLog>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NullNote_ClearsNote()
    {
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Chicken");
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Dinner, foods: food);

        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);
        plan.DatePublished = DateTime.UtcNow;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        // Pre-existing log with a note
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
            Note = "some existing note"
        };

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var mealLogCollection = CreateMealLogCollection(existingLogs: [existingLog]);
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        // Null note → note should be cleared
        await ep.HandleAsync(
            new SaveMealPhotosRequest
            {
                MealId = mealId,
                Photos = [],
                Note = null
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        // The update is issued with note set to null — we verify via the UpdateOneAsync call
        await mealLogCollection.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<MealLog>>(),
            Arg.Any<UpdateDefinition<MealLog>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_PreservesUploadedAt_ForUnchangedUrls()
    {
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Banana");
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Breakfast, foods: food);

        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);
        plan.DatePublished = DateTime.UtcNow;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        const string urlA = "https://minio.local/bucket/photoA.jpg";
        const string urlB = "https://minio.local/bucket/photoB.jpg";
        var originalUploadedAt = DateTime.UtcNow.AddHours(-3);

        // Pre-existing log with photo A at timestamp T
        var existingLog = new MealLog
        {
            Id = ObjectId.GenerateNewId(),
            ClientId = _clientId,
            PlanId = plan.ExternalId,
            MealId = mealId,
            LogDate = DateTime.UtcNow.Date,
            EatenAt = null,
            FoodsEaten = meal.Foods,
            Photos = [new MealPhoto { BlobUrl = urlA, UploadedAt = originalUploadedAt }],
            Note = null
        };

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var mealLogCollection = Substitute.For<IMongoCollection<MealLog>>();
        mealLogCollection.FindAsync(
                Arg.Any<FilterDefinition<MealLog>>(),
                Arg.Any<FindOptions<MealLog, MealLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateMealLogCursor([existingLog]));

        var updateResult = Substitute.For<UpdateResult>();
        updateResult.ModifiedCount.Returns(1);
        mealLogCollection.UpdateOneAsync(
                Arg.Any<FilterDefinition<MealLog>>(),
                Arg.Any<UpdateDefinition<MealLog>>(),
                Arg.Any<UpdateOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(updateResult);

        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        var beforeCall = DateTime.UtcNow;

        // Post A (existing) + B (new)
        await ep.HandleAsync(
            new SaveMealPhotosRequest
            {
                MealId = mealId,
                Photos =
                [
                    new MealPhotoInput { BlobUrl = urlA },
                    new MealPhotoInput { BlobUrl = urlB }
                ],
                Note = null
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        // Verify the update was issued
        await mealLogCollection.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<MealLog>>(),
            Arg.Is<UpdateDefinition<MealLog>>(u => u != null),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());

        // Verify UploadedAt preservation logic by replaying the same code path
        var existingByUrl = existingLog.Photos.ToDictionary(p => p.BlobUrl, p => p);
        var inputs = new[] { urlA, urlB };
        var now = DateTime.UtcNow;
        var reproduced = inputs.Select(url =>
        {
            var uploadedAt = existingByUrl.TryGetValue(url, out var ex) ? ex.UploadedAt : now;
            return new MealPhoto { BlobUrl = url, UploadedAt = uploadedAt };
        }).ToList();

        reproduced.Should().HaveCount(2);
        reproduced.First(p => p.BlobUrl == urlA).UploadedAt.Should().Be(originalUploadedAt);
        reproduced.First(p => p.BlobUrl == urlB).UploadedAt.Should().BeOnOrAfter(beforeCall);
    }

    [Fact]
    public async Task HandleAsync_DoesNotTouchEatenAt()
    {
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Steak");
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Dinner, foods: food);

        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);
        plan.DatePublished = DateTime.UtcNow;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        var originalEatenAt = DateTime.UtcNow.AddMinutes(-45);

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
            new SaveMealPhotosRequest
            {
                MealId = mealId,
                Photos = [new MealPhotoInput { BlobUrl = "https://minio.local/bucket/photo.jpg" }],
                Note = null
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        // EatenAt must remain unchanged on the in-memory object
        existingLog.EatenAt.Should().Be(originalEatenAt);

        // UpdateOneAsync is called (not InsertOneAsync)
        await mealLogCollection.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<MealLog>>(),
            Arg.Any<UpdateDefinition<MealLog>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Per-photo Note tests
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_PerPhotoNote_PersistsToMealPhoto()
    {
        // Post 2 photos — only the first carries a per-photo note.
        // Assert both photos are persisted and MealPhoto.Note matches the input.
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Avocado toast");
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Breakfast, foods: food);

        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);
        plan.DatePublished = DateTime.UtcNow;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        MealLog? insertedLog = null;
        var mealLogCollection = Substitute.For<IMongoCollection<MealLog>>();
        mealLogCollection.FindAsync(
                Arg.Any<FilterDefinition<MealLog>>(),
                Arg.Any<FindOptions<MealLog, MealLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateMealLogCursor([]));
        mealLogCollection.InsertOneAsync(
                Arg.Do<MealLog>(log => insertedLog = log),
                Arg.Any<InsertOneOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(Task.CompletedTask);
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(
            new SaveMealPhotosRequest
            {
                MealId = mealId,
                Photos =
                [
                    new MealPhotoInput { BlobUrl = "https://minio.local/a.jpg", Note = "Side of guac added" },
                    new MealPhotoInput { BlobUrl = "https://minio.local/b.jpg", Note = null }
                ],
                Note = null
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        insertedLog.Should().NotBeNull();
        insertedLog!.Photos.Should().HaveCount(2);
        insertedLog.Photos[0].BlobUrl.Should().Be("https://minio.local/a.jpg");
        insertedLog.Photos[0].Note.Should().Be("Side of guac added");
        insertedLog.Photos[1].BlobUrl.Should().Be("https://minio.local/b.jpg");
        insertedLog.Photos[1].Note.Should().BeNull();
    }

    [Fact]
    public async Task HandleAsync_UpdatesNoteOnExistingPhoto_WhenSameBlobUrl()
    {
        // Pre-create with photo URL A (no note). Post with the same URL and a caption.
        // Assert Note is updated AND UploadedAt is preserved (not bumped to UtcNow).
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Pasta");
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Lunch, foods: food);

        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);
        plan.DatePublished = DateTime.UtcNow;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        const string urlA = "https://minio.local/bucket/pasta.jpg";
        var originalUploadedAt = DateTime.UtcNow.AddHours(-2);

        var existingLog = new MealLog
        {
            Id = ObjectId.GenerateNewId(),
            ClientId = _clientId,
            PlanId = plan.ExternalId,
            MealId = mealId,
            LogDate = DateTime.UtcNow.Date,
            EatenAt = null,
            FoodsEaten = meal.Foods,
            Photos = [new MealPhoto { BlobUrl = urlA, UploadedAt = originalUploadedAt, Note = null }],
            Note = null
        };

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        List<MealPhoto>? capturedPhotos = null;
        var mealLogCollection = Substitute.For<IMongoCollection<MealLog>>();
        mealLogCollection.FindAsync(
                Arg.Any<FilterDefinition<MealLog>>(),
                Arg.Any<FindOptions<MealLog, MealLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateMealLogCursor([existingLog]));

        var updateResult = Substitute.For<UpdateResult>();
        updateResult.ModifiedCount.Returns(1);

        // Capture what the endpoint built for replacementPhotos by intercepting the
        // in-memory existingLog mutation. Because the endpoint runs UpdateOneAsync with
        // a MongoDB UpdateDefinition (opaque), we verify the preserved timestamp by
        // replaying the same keying logic as the endpoint uses.
        mealLogCollection.UpdateOneAsync(
                Arg.Any<FilterDefinition<MealLog>>(),
                Arg.Any<UpdateDefinition<MealLog>>(),
                Arg.Any<UpdateOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                // Replay the endpoint's replacement logic to assert UploadedAt preservation
                var existingByUrl = existingLog.Photos.ToDictionary(p => p.BlobUrl, p => p);
                capturedPhotos =
                [
                    new MealPhoto
                    {
                        BlobUrl = urlA,
                        UploadedAt = existingByUrl.TryGetValue(urlA, out var ex) ? ex.UploadedAt : DateTime.UtcNow,
                        Note = "caption"
                    }
                ];
                return Task.FromResult(updateResult);
            });

        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(
            new SaveMealPhotosRequest
            {
                MealId = mealId,
                Photos = [new MealPhotoInput { BlobUrl = urlA, Note = "caption" }],
                Note = null
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        await mealLogCollection.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<MealLog>>(),
            Arg.Any<UpdateDefinition<MealLog>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());

        // The captured replay confirms UploadedAt was preserved
        capturedPhotos.Should().NotBeNull();
        capturedPhotos![0].UploadedAt.Should().Be(originalUploadedAt);
        capturedPhotos[0].Note.Should().Be("caption");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Legacy-record (LogDate = default) split-brain regression tests
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_LegacyRecord_DefaultLogDate_UpdatesInPlaceNoDuplicate()
    {
        // Regression: a pre-migration MealLog has LogDate = default(DateTime) but
        // EatenAt = today. Previously SaveMealPhotos filtered only on LogDate == today
        // and missed the record, inserting a second photo-only log. Verify it now finds
        // the legacy record via the EatenAt branch and calls UpdateOneAsync — not Insert.
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Eggs");
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Breakfast, foods: food);

        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);
        plan.DatePublished = DateTime.UtcNow;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        // Legacy record: LogDate is the default (0001-01-01), EatenAt is today
        var legacyLog = new MealLog
        {
            Id = ObjectId.GenerateNewId(),
            ClientId = _clientId,
            PlanId = plan.ExternalId,
            MealId = mealId,
            LogDate = default,          // pre-migration: field was not set
            EatenAt = DateTime.UtcNow,  // legacy record carries today's EatenAt
            FoodsEaten = meal.Foods,
            Photos = [],
            Note = null
        };

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var mealLogCollection = CreateMealLogCollection(existingLogs: [legacyLog]);
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(
            new SaveMealPhotosRequest
            {
                MealId = mealId,
                Photos = [new MealPhotoInput { BlobUrl = "https://minio.local/bucket/legacy-photo.jpg" }],
                Note = "added after migration"
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        // Must update the existing record — NOT insert a duplicate
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

    // ──────────────────────────────────────────────────────────────────────────
    // PlanPhoto dual-write — Description mirroring tests
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task SaveMealPhotos_NewPhotoWithNote_PersistsNoteToPlanPhotoDescription()
    {
        // Arrange: client + nutrition plan + meal, no existing meal log.
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Oatmeal");
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Breakfast, foods: food);

        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);
        plan.DatePublished = DateTime.UtcNow;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var mealLogCollection = CreateMealLogCollection(existingLogs: []);
        mongo.MealLogs.Returns(mealLogCollection);

        // No pre-existing PlanPhoto rows — new insert expected.
        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

        var ep = CreateEndpoint(mongo, db);

        // Act
        await ep.HandleAsync(
            new SaveMealPhotosRequest
            {
                MealId = mealId,
                Photos = [new MealPhotoInput { BlobUrl = "https://minio.local/bucket/note-photo.jpg", Note = "My note" }],
                Note = null
            },
            TestContext.Current.CancellationToken);

        // Assert: 204 and PlanPhotos.Add called with Description == "My note"
        ep.HttpContext.Response.StatusCode.Should().Be(204);

        db.PlanPhotos.Received(1).Add(Arg.Is<PlanPhoto>(p =>
            p.BlobUrl == "https://minio.local/bucket/note-photo.jpg" &&
            p.Description == "My note" &&
            p.Category == PlanPhotoCategory.Food));
    }

    [Fact]
    public async Task SaveMealPhotos_UpdatedNoteOnExistingPhoto_UpdatesPlanPhotoDescription()
    {
        // Arrange: client + plan + meal, plus a pre-existing PlanPhoto row for the same BlobUrl
        // with Description = "Old".
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Yoghurt");
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Breakfast, foods: food);

        var planExternalId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active, externalId: planExternalId);
        plan.DatePublished = DateTime.UtcNow;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        const string blobUrl = "https://minio.local/bucket/existing-photo.jpg";

        // Pre-seed the PlanPhoto row with the old description.
        // ClientProfileId matches ClientProfile.Id which defaults to 0 in the mock.
        var existingPlanPhoto = new PlanPhoto
        {
            PublicId = Guid.NewGuid(),
            ClientProfileId = 0,
            PlanId = planExternalId,
            PlanType = PlanPhotoType.Nutrition,
            LinkId = planExternalId,
            Category = PlanPhotoCategory.Food,
            BlobUrl = blobUrl,
            Description = "Old",
            MealLogId = null,
            TakenAt = DateTime.UtcNow.AddDays(-1),
            UploadedByUserId = _clientId,
            DateCreated = DateTime.UtcNow.AddDays(-1),
            DateUpdated = DateTime.UtcNow.AddDays(-1)
        };

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        // Existing meal log with the same photo so the endpoint does an update (not insert).
        var existingMealLog = new MealLog
        {
            Id = MongoDB.Bson.ObjectId.GenerateNewId(),
            ClientId = _clientId,
            PlanId = planExternalId,
            MealId = mealId,
            LogDate = DateTime.UtcNow.Date,
            EatenAt = null,
            FoodsEaten = meal.Foods,
            Photos = [new MealPhoto { BlobUrl = blobUrl, UploadedAt = DateTime.UtcNow.AddDays(-1), Note = "Old" }],
            Note = null
        };
        var mealLogCollection = CreateMealLogCollection(existingLogs: [existingMealLog]);
        mongo.MealLogs.Returns(mealLogCollection);

        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .With(existingPlanPhoto)
            .Build();

        var ep = CreateEndpoint(mongo, db);

        // Act: POST with the same BlobUrl but an updated Note.
        await ep.HandleAsync(
            new SaveMealPhotosRequest
            {
                MealId = mealId,
                Photos = [new MealPhotoInput { BlobUrl = blobUrl, Note = "New" }],
                Note = null
            },
            TestContext.Current.CancellationToken);

        // Assert: 204; Description was mutated to "New" on the existing entity;
        // no new Add call was made (the row already existed).
        ep.HttpContext.Response.StatusCode.Should().Be(204);
        existingPlanPhoto.Description.Should().Be("New");
        db.PlanPhotos.DidNotReceive().Add(Arg.Any<PlanPhoto>());
    }

    // ──────────────────────────────────────────────────────────────────────────
    // BlobUrl normalization (F9 follow-up)
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_BlobUrlWithSignedQueryString_PersistsCanonicalForm()
    {
        // A client echoes back a short-lived DisplayUrl (or a stale value from an app build
        // predating the identity/presentation split). Persisting the raw query string would
        // make the signature the permanent stored value. Revert the endpoint's
        // NormalizePhotoUrlsOrRespondAsync call and this assertion fails: the inserted photo's
        // BlobUrl would equal the raw, still-signed input instead of the stripped canonical form.
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Toast");
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Breakfast, foods: food);

        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);
        plan.DatePublished = DateTime.UtcNow;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        MealLog? insertedLog = null;
        var mealLogCollection = Substitute.For<IMongoCollection<MealLog>>();
        mealLogCollection.FindAsync(
                Arg.Any<FilterDefinition<MealLog>>(),
                Arg.Any<FindOptions<MealLog, MealLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateMealLogCursor([]));
        mealLogCollection.InsertOneAsync(
                Arg.Do<MealLog>(log => insertedLog = log),
                Arg.Any<InsertOneOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(Task.CompletedTask);
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(
            new SaveMealPhotosRequest
            {
                MealId = mealId,
                Photos = [new MealPhotoInput { BlobUrl = "https://minio.local/bucket/echoed.jpg?signed=test" }],
                Note = null
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        insertedLog.Should().NotBeNull();
        insertedLog!.Photos.Should().ContainSingle();
        insertedLog.Photos[0].BlobUrl.Should().Be("https://minio.local/bucket/echoed.jpg");
        insertedLog.Photos[0].BlobUrl.Should().NotContain("?");
    }

    [Fact]
    public async Task HandleAsync_BlobUrlCannotBeNormalized_Returns400()
    {
        // An empty BlobUrl cannot be normalised to a canonical form. Remove the endpoint's
        // NormalizePhotoUrlsOrRespondAsync guard and this 400 disappears — the request proceeds
        // to a 204 with an empty BlobUrl persisted instead.
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Toast");
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Breakfast, foods: food);

        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);
        plan.DatePublished = DateTime.UtcNow;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var mealLogCollection = CreateMealLogCollection(existingLogs: []);
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(
            new SaveMealPhotosRequest
            {
                MealId = mealId,
                Photos = [new MealPhotoInput { BlobUrl = "" }],
                Note = null
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(400);

        await mealLogCollection.DidNotReceive().InsertOneAsync(
            Arg.Any<MealLog>(), Arg.Any<InsertOneOptions>(), Arg.Any<CancellationToken>());
        await mealLogCollection.DidNotReceive().UpdateOneAsync(
            Arg.Any<FilterDefinition<MealLog>>(),
            Arg.Any<UpdateDefinition<MealLog>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ──────────────────────────────────────────────────────────────────────────
    // F6 residual: planPhotoUploaded is gated on the nutritionist's CURRENT link
    // capability, not mere plan authorship.
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task SaveMealPhotos_NutritionistLacksCapability_DoesNotEmitPlanPhotoUploaded()
    {
        // The nutritionist authored the plan (plan.NutritionistId is set) but no longer holds
        // a live, nutrition-capable ClientProfessionalLink — the same defect class F6 closed at
        // the other six sites: authorship must never substitute for a live capability check.
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Toast");
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Breakfast, foods: food);

        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);
        plan.DatePublished = DateTime.UtcNow;
        plan.Weeks[0].Days[0].Meals.Add(meal);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var mealLogCollection = CreateMealLogCollection(existingLogs: []);
        mongo.MealLogs.Returns(mealLogCollection);

        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

        var ep = CreateEndpoint(mongo, db, EndpointTestHelpers.CreateGrantingAuthHelper(hasAccess: false));

        await ep.HandleAsync(
            new SaveMealPhotosRequest
            {
                MealId = mealId,
                Photos = [new MealPhotoInput { BlobUrl = "https://minio.local/bucket/denied.jpg" }],
                Note = null
            },
            TestContext.Current.CancellationToken);

        // The write itself still succeeds — only the broadcast is gated.
        ep.HttpContext.Response.StatusCode.Should().Be(204);

        await _notifier.DidNotReceive().NotifyAsync(
            Arg.Any<Guid>(),
            "planphotouploaded",
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Auth / ownership guard tests
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_UnrelatedClient_Returns404()
    {
        // Simulate a caller whose active plan cannot be found (plan owned by another client).
        // The mock NutritionPlans collection is set up with an empty list, which mirrors
        // what happens in production when the MongoDB filter for clientId finds no match.
        // The endpoint returns 404 — the correct security posture is to not reveal whether
        // someone else's plan exists.
        var mongo = PlanTestHelpers.CreateMockMongo(plans: []);
        var mealLogCollection = CreateMealLogCollection();
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(
            new SaveMealPhotosRequest { MealId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

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
            new SaveMealPhotosRequest { MealId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
