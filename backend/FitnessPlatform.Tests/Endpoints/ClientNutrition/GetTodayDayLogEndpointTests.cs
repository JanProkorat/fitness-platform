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
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Tests for <see cref="GetTodayDayLogEndpoint"/>.
/// </summary>
public class GetTodayDayLogEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

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

    private GetTodayDayLogEndpoint CreateEndpoint(IMongoContext mongo, IApplicationDbContext db) =>
        Factory.Create<GetTodayDayLogEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db);

    // ──────────────────────────────────────────────────────────────────────────
    // Happy-path tests
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NoDayLog_ReturnsEmptyPhotosAndNullNote()
    {
        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);

        var dayLogCollection = Substitute.For<IMongoCollection<DayLog>>();
        dayLogCollection.FindAsync(
                Arg.Any<FilterDefinition<DayLog>>(),
                Arg.Any<FindOptions<DayLog, DayLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateDayLogCursor([]));
        mongo.DayLogs.Returns(dayLogCollection);

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
            Id = MongoDB.Bson.ObjectId.GenerateNewId().ToString(),
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
        var dayLogCollection = Substitute.For<IMongoCollection<DayLog>>();
        dayLogCollection.FindAsync(
                Arg.Any<FilterDefinition<DayLog>>(),
                Arg.Any<FindOptions<DayLog, DayLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateDayLogCursor([dayLog]));
        mongo.DayLogs.Returns(dayLogCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Note.Should().Be("Feeling strong");
        ep.Response.Photos.Should().HaveCount(1);
        ep.Response.Photos[0].BlobUrl.Should().Be("https://minio.local/plan-photos/photo1.jpg");
        ep.Response.Photos[0].UploadedAt.Should().Be(uploadedAt);
        ep.Response.Photos[0].Note.Should().Be("Morning shot");
        ep.Response.Photos[0].Category.Should().Be("Progress");
    }

    [Fact]
    public async Task HandleAsync_MultipleCategories_RoundTripCorrectly()
    {
        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);

        var dayLog = new DayLog
        {
            Id = MongoDB.Bson.ObjectId.GenerateNewId().ToString(),
            ClientId = _clientId,
            PlanId = plan.ExternalId,
            LogDate = DateTime.UtcNow.Date,
            Photos =
            [
                new DayPhoto { BlobUrl = "https://minio.local/a.jpg", UploadedAt = DateTime.UtcNow, Category = DayPhotoCategory.Food },
                new DayPhoto { BlobUrl = "https://minio.local/b.jpg", UploadedAt = DateTime.UtcNow, Category = DayPhotoCategory.Progress },
                new DayPhoto { BlobUrl = "https://minio.local/c.jpg", UploadedAt = DateTime.UtcNow, Category = DayPhotoCategory.Free }
            ],
            Note = null,
            Version = 1
        };

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var dayLogCollection = Substitute.For<IMongoCollection<DayLog>>();
        dayLogCollection.FindAsync(
                Arg.Any<FilterDefinition<DayLog>>(),
                Arg.Any<FindOptions<DayLog, DayLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ => CreateDayLogCursor([dayLog]));
        mongo.DayLogs.Returns(dayLogCollection);

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Photos.Should().HaveCount(3);
        ep.Response.Photos[0].Category.Should().Be("Food");
        ep.Response.Photos[1].Category.Should().Be("Progress");
        ep.Response.Photos[2].Category.Should().Be("Free");
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

        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Photos.Should().BeEmpty();
        ep.Response.Note.Should().BeNull();

        // DayLogs collection must not be queried if there's no active plan
        await dayLogCollection.DidNotReceive().FindAsync(
            Arg.Any<FilterDefinition<DayLog>>(),
            Arg.Any<FindOptions<DayLog, DayLog>>(),
            Arg.Any<CancellationToken>());
    }
}
