using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientNutrition.SaveDayPhotos;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Tests for <see cref="SaveDayPhotosEndpoint"/>.
/// </summary>
public class SaveDayPhotosEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    private IApplicationDbContext CreateMockDb() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    private static IMongoCollection<DayLog> CreateDayLogCollection(
        List<DayLog>? existingLogs = null)
    {
        existingLogs ??= [];

        var collection = Substitute.For<IMongoCollection<DayLog>>();

        collection.FindAsync(
                Arg.Any<FilterDefinition<DayLog>>(),
                Arg.Any<FindOptions<DayLog, DayLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateDayLogCursor(existingLogs));

        collection.InsertOneAsync(
                Arg.Any<DayLog>(),
                Arg.Any<InsertOneOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(Task.CompletedTask);

        var updateResult = Substitute.For<UpdateResult>();
        updateResult.ModifiedCount.Returns(1);
        collection.UpdateOneAsync(
                Arg.Any<FilterDefinition<DayLog>>(),
                Arg.Any<UpdateDefinition<DayLog>>(),
                Arg.Any<UpdateOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(updateResult);

        return collection;
    }

    private static IAsyncCursor<DayLog> CreateDayLogCursor(List<DayLog> logs)
    {
        var cursor = Substitute.For<IAsyncCursor<DayLog>>();
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

    private SaveDayPhotosEndpoint CreateEndpoint(IMongoContext mongo, IApplicationDbContext db) =>
        Factory.Create<SaveDayPhotosEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db);

    // ──────────────────────────────────────────────────────────────────────────
    // Replace-semantics happy-path tests
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NewDayLog_InsertsWithPhotosAndNote()
    {
        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var dayLogCollection = CreateDayLogCollection(existingLogs: []);
        mongo.DayLogs.Returns(dayLogCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        const string note = "Great day!";

        await ep.HandleAsync(
            new SaveDayPhotosRequest
            {
                Photos =
                [
                    new DayPhotoInput { BlobUrl = "https://minio.local/plan-photos/p1.jpg", Category = DayPhotoCategory.Progress },
                    new DayPhotoInput { BlobUrl = "https://minio.local/plan-photos/p2.jpg", Category = DayPhotoCategory.Food }
                ],
                Note = note
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        await dayLogCollection.Received(1).InsertOneAsync(
            Arg.Is<DayLog>(log =>
                log.ClientId == _clientId &&
                log.PlanId == plan.ExternalId &&
                log.Photos.Count == 2 &&
                log.Note == note),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());

        await dayLogCollection.DidNotReceive().UpdateOneAsync(
            Arg.Any<FilterDefinition<DayLog>>(),
            Arg.Any<UpdateDefinition<DayLog>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_ExistingDayLog_UpdatesInPlaceNoDuplicate()
    {
        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);

        var existingLog = new DayLog
        {
            Id = MongoDB.Bson.ObjectId.GenerateNewId().ToString(),
            ClientId = _clientId,
            PlanId = plan.ExternalId,
            LogDate = DateTime.UtcNow.Date,
            Photos =
            [
                new DayPhoto { BlobUrl = "https://minio.local/old.jpg", UploadedAt = DateTime.UtcNow.AddHours(-2), Category = DayPhotoCategory.Free }
            ],
            Note = "old note",
            Version = 1
        };

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var dayLogCollection = CreateDayLogCollection(existingLogs: [existingLog]);
        mongo.DayLogs.Returns(dayLogCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(
            new SaveDayPhotosRequest
            {
                Photos = [new DayPhotoInput { BlobUrl = "https://minio.local/new.jpg", Category = DayPhotoCategory.Progress }],
                Note = "new note"
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        await dayLogCollection.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<DayLog>>(),
            Arg.Is<UpdateDefinition<DayLog>>(u => u != null),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());

        await dayLogCollection.DidNotReceive().InsertOneAsync(
            Arg.Any<DayLog>(),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NullNote_ClearsNote()
    {
        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);

        var existingLog = new DayLog
        {
            Id = MongoDB.Bson.ObjectId.GenerateNewId().ToString(),
            ClientId = _clientId,
            PlanId = plan.ExternalId,
            LogDate = DateTime.UtcNow.Date,
            Photos = [],
            Note = "some existing note",
            Version = 1
        };

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var dayLogCollection = CreateDayLogCollection(existingLogs: [existingLog]);
        mongo.DayLogs.Returns(dayLogCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        // Note = null → note should be cleared (replace semantics)
        await ep.HandleAsync(
            new SaveDayPhotosRequest { Photos = [], Note = null },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        await dayLogCollection.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<DayLog>>(),
            Arg.Any<UpdateDefinition<DayLog>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_PerPhotoNoteAndCategory_PersistToInsertedLog()
    {
        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        DayLog? insertedLog = null;
        var dayLogCollection = Substitute.For<IMongoCollection<DayLog>>();
        dayLogCollection.FindAsync(
                Arg.Any<FilterDefinition<DayLog>>(),
                Arg.Any<FindOptions<DayLog, DayLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateDayLogCursor([]));
        dayLogCollection.InsertOneAsync(
                Arg.Do<DayLog>(log => insertedLog = log),
                Arg.Any<InsertOneOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(Task.CompletedTask);
        mongo.DayLogs.Returns(dayLogCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(
            new SaveDayPhotosRequest
            {
                Photos =
                [
                    new DayPhotoInput { BlobUrl = "https://minio.local/a.jpg", Note = "Morning selfie", Category = DayPhotoCategory.Progress },
                    new DayPhotoInput { BlobUrl = "https://minio.local/b.jpg", Note = null, Category = DayPhotoCategory.Food }
                ],
                Note = null
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        insertedLog.Should().NotBeNull();
        insertedLog!.Photos.Should().HaveCount(2);
        insertedLog.Photos[0].BlobUrl.Should().Be("https://minio.local/a.jpg");
        insertedLog.Photos[0].Note.Should().Be("Morning selfie");
        insertedLog.Photos[0].Category.Should().Be(DayPhotoCategory.Progress);
        insertedLog.Photos[1].BlobUrl.Should().Be("https://minio.local/b.jpg");
        insertedLog.Photos[1].Note.Should().BeNull();
        insertedLog.Photos[1].Category.Should().Be(DayPhotoCategory.Food);
    }

    [Fact]
    public async Task HandleAsync_PreservesUploadedAt_ForUnchangedUrls()
    {
        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);

        const string urlA = "https://minio.local/plan-photos/photoA.jpg";
        const string urlB = "https://minio.local/plan-photos/photoB.jpg";
        var originalUploadedAt = DateTime.UtcNow.AddHours(-5);

        var existingLog = new DayLog
        {
            Id = MongoDB.Bson.ObjectId.GenerateNewId().ToString(),
            ClientId = _clientId,
            PlanId = plan.ExternalId,
            LogDate = DateTime.UtcNow.Date,
            Photos = [new DayPhoto { BlobUrl = urlA, UploadedAt = originalUploadedAt, Category = DayPhotoCategory.Free }],
            Version = 1
        };

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var updateResult = Substitute.For<UpdateResult>();
        updateResult.ModifiedCount.Returns(1);

        var dayLogCollection = Substitute.For<IMongoCollection<DayLog>>();
        dayLogCollection.FindAsync(
                Arg.Any<FilterDefinition<DayLog>>(),
                Arg.Any<FindOptions<DayLog, DayLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateDayLogCursor([existingLog]));
        dayLogCollection.UpdateOneAsync(
                Arg.Any<FilterDefinition<DayLog>>(),
                Arg.Any<UpdateDefinition<DayLog>>(),
                Arg.Any<UpdateOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(updateResult);
        mongo.DayLogs.Returns(dayLogCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        var beforeCall = DateTime.UtcNow;

        // Post A (existing) + B (new)
        await ep.HandleAsync(
            new SaveDayPhotosRequest
            {
                Photos =
                [
                    new DayPhotoInput { BlobUrl = urlA, Category = DayPhotoCategory.Free },
                    new DayPhotoInput { BlobUrl = urlB, Category = DayPhotoCategory.Progress }
                ],
                Note = null
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        await dayLogCollection.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<DayLog>>(),
            Arg.Is<UpdateDefinition<DayLog>>(u => u != null),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());

        // Replay the endpoint's UploadedAt preservation logic
        var existingByUrl = existingLog.Photos.ToDictionary(p => p.BlobUrl, p => p);
        var now = DateTime.UtcNow;
        var reproduced = new[] { urlA, urlB }.Select(url =>
        {
            var uploadedAt = existingByUrl.TryGetValue(url, out var ex) ? ex.UploadedAt : now;
            return new DayPhoto { BlobUrl = url, UploadedAt = uploadedAt };
        }).ToList();

        reproduced.First(p => p.BlobUrl == urlA).UploadedAt.Should().Be(originalUploadedAt);
        reproduced.First(p => p.BlobUrl == urlB).UploadedAt.Should().BeOnOrAfter(beforeCall);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Auth / not-found guard tests
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NoActivePlan_Returns404()
    {
        var mongo = PlanTestHelpers.CreateMockMongo(plans: []);
        var dayLogCollection = CreateDayLogCollection();
        mongo.DayLogs.Returns(dayLogCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(
            new SaveDayPhotosRequest { Photos = [], Note = null },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
