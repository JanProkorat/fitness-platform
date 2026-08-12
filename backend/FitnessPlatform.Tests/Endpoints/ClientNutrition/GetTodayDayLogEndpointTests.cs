using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientNutrition.GetTodayDayLog;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using FitnessPlatform.Tests.Infrastructure;
using MongoDB.Bson;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Tests for <see cref="GetTodayDayLogEndpoint"/>.
/// </summary>
public class GetTodayDayLogEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    /// <summary>
    /// Shared fake so tests can assert on <see cref="FakeBlobStorageService.SignedUrlRequests"/> —
    /// which stored BlobUrls were routed through signing before the response was sent (F9).
    /// </summary>
    private readonly FakeBlobStorageService _blobStorage = new();

    private IApplicationDbContext CreateMockDb() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

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

    /// <summary>
    /// Wires a DayLog collection mock and a MealLog collection mock onto the provided IMongoContext.
    /// </summary>
    private static void WireDayAndMealCollections(
        IMongoContext mongo,
        List<DayLog> dayLogs,
        List<MealLog> mealLogs)
    {
        var dayLogCollection = Substitute.For<IMongoCollection<DayLog>>();
        dayLogCollection.FindAsync(
                Arg.Any<FilterDefinition<DayLog>>(),
                Arg.Any<FindOptions<DayLog, DayLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateDayLogCursor(dayLogs));
        mongo.DayLogs.Returns(dayLogCollection);

        var mealLogCollection = Substitute.For<IMongoCollection<MealLog>>();
        mealLogCollection.FindAsync(
                Arg.Any<FilterDefinition<MealLog>>(),
                Arg.Any<FindOptions<MealLog, MealLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateMealLogCursor(mealLogs));
        mongo.MealLogs.Returns(mealLogCollection);
    }

    private GetTodayDayLogEndpoint CreateEndpoint(IMongoContext mongo, IApplicationDbContext db) =>
        Factory.Create<GetTodayDayLogEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _blobStorage);

    // ──────────────────────────────────────────────────────────────────────────
    // Happy-path tests
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NoDayLog_ReturnsEmptyPhotosAndNullNote()
    {
        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        WireDayAndMealCollections(mongo, dayLogs: [], mealLogs: []);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Photos.Should().BeEmpty();
        ep.Response.Note.Should().BeNull();
    }

    [Fact]
    public async Task HandleAsync_ExistingDayLog_ReturnsPhotosAndNote()
    {
        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);

        var uploadedAt = DateTime.UtcNow.AddHours(-1);
        var dayLog = new DayLog
        {
            Id = ObjectId.GenerateNewId().ToString(),
            ClientId = _clientId,
            PlanId = plan.ExternalId,
            LogDate = DateTime.UtcNow.Date,
            Photos =
            [
                new DayPhoto
                {
                    BlobUrl = "https://minio.local/plan-photos/photo1.jpg",
                    UploadedAt = uploadedAt,
                    Note = "Morning shot",
                    Category = DayPhotoCategory.Progress
                }
            ],
            Note = "Feeling strong",
            Version = 1
        };

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        WireDayAndMealCollections(mongo, dayLogs: [dayLog], mealLogs: []);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Note.Should().Be("Feeling strong");
        ep.Response.Photos.Should().HaveCount(1);

        // Positive control: the stored BlobUrl reached the signing call verbatim.
        _blobStorage.SignedUrlRequests.Should().Contain("https://minio.local/plan-photos/photo1.jpg");

        // Negative control: DisplayUrl carries the signed marker — the bucket no longer grants
        // public read on plan-photos/* (F9) — while BlobUrl stays the canonical, permanent
        // identity value so a client can safely echo it back on a later SaveDayPhotos call.
        ep.Response.Photos[0].DisplayUrl.Should().Be("https://minio.local/plan-photos/photo1.jpg?signed=test");
        ep.Response.Photos[0].BlobUrl.Should().Be("https://minio.local/plan-photos/photo1.jpg");
        ep.Response.Photos[0].UploadedAt.Should().Be(uploadedAt);
        ep.Response.Photos[0].Note.Should().Be("Morning shot");
        ep.Response.Photos[0].Category.Should().Be("Progress");
    }

    [Fact]
    public async Task HandleAsync_MultipleCategories_RoundTripCorrectly()
    {
        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);

        var now = DateTime.UtcNow;
        var dayLog = new DayLog
        {
            Id = ObjectId.GenerateNewId().ToString(),
            ClientId = _clientId,
            PlanId = plan.ExternalId,
            LogDate = DateTime.UtcNow.Date,
            Photos =
            [
                new DayPhoto { BlobUrl = "https://minio.local/a.jpg", UploadedAt = now.AddMinutes(-3), Category = DayPhotoCategory.Food },
                new DayPhoto { BlobUrl = "https://minio.local/b.jpg", UploadedAt = now.AddMinutes(-2), Category = DayPhotoCategory.Progress },
                new DayPhoto { BlobUrl = "https://minio.local/c.jpg", UploadedAt = now.AddMinutes(-1), Category = DayPhotoCategory.Free }
            ],
            Note = null,
            Version = 1
        };

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        WireDayAndMealCollections(mongo, dayLogs: [dayLog], mealLogs: []);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        // Descending order: Free (newest), Progress, Food (oldest)
        ep.Response.Photos.Should().HaveCount(3);
        ep.Response.Photos[0].Category.Should().Be("Free");
        ep.Response.Photos[1].Category.Should().Be("Progress");
        ep.Response.Photos[2].Category.Should().Be("Food");
        ep.Response.Note.Should().BeNull();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // No active plan edge case
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NoActivePlan_ReturnsEmptyResponse()
    {
        var mongo = PlanTestHelpers.CreateMockMongo(plans: []);
        var dayLogCollection = Substitute.For<IMongoCollection<DayLog>>();
        mongo.DayLogs.Returns(dayLogCollection);
        var mealLogCollection = Substitute.For<IMongoCollection<MealLog>>();
        mongo.MealLogs.Returns(mealLogCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Photos.Should().BeEmpty();
        ep.Response.Note.Should().BeNull();

        // Neither collection must be queried if there's no active plan
        await dayLogCollection.DidNotReceive().FindAsync(
            Arg.Any<FilterDefinition<DayLog>>(),
            Arg.Any<FindOptions<DayLog, DayLog>>(),
            Arg.Any<CancellationToken>());
        await mealLogCollection.DidNotReceive().FindAsync(
            Arg.Any<FilterDefinition<MealLog>>(),
            Arg.Any<FindOptions<MealLog, MealLog>>(),
            Arg.Any<CancellationToken>());
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Meal-photo aggregation tests
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_AggregatesMealPhotosAsFoodCategory()
    {
        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);

        var uploadedAt1 = DateTime.UtcNow.AddMinutes(-10);
        var uploadedAt2 = DateTime.UtcNow.AddMinutes(-5);

        var mealLog = new MealLog
        {
            Id = ObjectId.GenerateNewId(),
            ClientId = _clientId,
            PlanId = plan.ExternalId,
            MealId = Guid.NewGuid(),
            LogDate = DateTime.UtcNow.Date,
            Photos =
            [
                new MealPhoto { BlobUrl = "https://minio.local/meal/a.jpg", UploadedAt = uploadedAt1, Note = "Before eating" },
                new MealPhoto { BlobUrl = "https://minio.local/meal/b.jpg", UploadedAt = uploadedAt2, Note = null }
            ]
        };

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        WireDayAndMealCollections(mongo, dayLogs: [], mealLogs: [mealLog]);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Photos.Should().HaveCount(2);
        ep.Response.Photos.Should().AllSatisfy(p => p.Category.Should().Be("Food"));
        // Descending order: uploadedAt2 (newer) first, then uploadedAt1
        ep.Response.Photos[0].DisplayUrl.Should().Be("https://minio.local/meal/b.jpg?signed=test");
        ep.Response.Photos[0].BlobUrl.Should().Be("https://minio.local/meal/b.jpg");
        ep.Response.Photos[0].UploadedAt.Should().Be(uploadedAt2);
        ep.Response.Photos[1].DisplayUrl.Should().Be("https://minio.local/meal/a.jpg?signed=test");
        ep.Response.Photos[1].UploadedAt.Should().Be(uploadedAt1);
        ep.Response.Photos[1].Note.Should().Be("Before eating");
        ep.Response.Note.Should().BeNull();
    }

    [Fact]
    public async Task HandleAsync_CombinesDayLogAndMealPhotos()
    {
        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);

        var oldest = DateTime.UtcNow.AddHours(-3);
        var middle = DateTime.UtcNow.AddHours(-2);
        var newest = DateTime.UtcNow.AddHours(-1);

        var dayLog = new DayLog
        {
            Id = ObjectId.GenerateNewId().ToString(),
            ClientId = _clientId,
            PlanId = plan.ExternalId,
            LogDate = DateTime.UtcNow.Date,
            Photos =
            [
                new DayPhoto
                {
                    BlobUrl = "https://minio.local/plan/progress.jpg",
                    UploadedAt = middle,
                    Note = "Body check",
                    Category = DayPhotoCategory.Progress
                }
            ],
            Note = "Great day",
            Version = 1
        };

        var mealLog = new MealLog
        {
            Id = ObjectId.GenerateNewId(),
            ClientId = _clientId,
            PlanId = plan.ExternalId,
            MealId = Guid.NewGuid(),
            LogDate = DateTime.UtcNow.Date,
            Photos =
            [
                new MealPhoto { BlobUrl = "https://minio.local/meal/lunch1.jpg", UploadedAt = oldest },
                new MealPhoto { BlobUrl = "https://minio.local/meal/lunch2.jpg", UploadedAt = newest }
            ]
        };

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        WireDayAndMealCollections(mongo, dayLogs: [dayLog], mealLogs: [mealLog]);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Note.Should().Be("Great day");
        ep.Response.Photos.Should().HaveCount(3);

        // Descending order: newest first
        ep.Response.Photos[0].DisplayUrl.Should().Be("https://minio.local/meal/lunch2.jpg?signed=test");
        ep.Response.Photos[0].BlobUrl.Should().Be("https://minio.local/meal/lunch2.jpg");
        ep.Response.Photos[0].Category.Should().Be("Food");
        ep.Response.Photos[0].UploadedAt.Should().Be(newest);

        ep.Response.Photos[1].DisplayUrl.Should().Be("https://minio.local/plan/progress.jpg?signed=test");
        ep.Response.Photos[1].Category.Should().Be("Progress");
        ep.Response.Photos[1].UploadedAt.Should().Be(middle);

        ep.Response.Photos[2].DisplayUrl.Should().Be("https://minio.local/meal/lunch1.jpg?signed=test");
        ep.Response.Photos[2].Category.Should().Be("Food");
        ep.Response.Photos[2].UploadedAt.Should().Be(oldest);
    }

    [Fact]
    public async Task HandleAsync_NoLogs_ReturnsEmpty()
    {
        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        WireDayAndMealCollections(mongo, dayLogs: [], mealLogs: []);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Photos.Should().BeEmpty();
        ep.Response.Note.Should().BeNull();
    }
}
