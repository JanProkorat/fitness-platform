using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientPlans.GeneratePlanPhotoUploadUrl;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientPlans;

/// <summary>
/// Tests for <see cref="GeneratePlanPhotoUploadUrlEndpoint"/>.
/// </summary>
public class GeneratePlanPhotoUploadUrlEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly IImageUploadService _imageUpload = Substitute.For<IImageUploadService>();

    private IApplicationDbContext CreateMockDb() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

    private GeneratePlanPhotoUploadUrlEndpoint CreateEndpoint(
        IMongoContext mongo,
        IApplicationDbContext db,
        Guid? callerUserId = null) =>
        Factory.Create<GeneratePlanPhotoUploadUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(callerUserId ?? _clientId, AppRoles.Client))),
            _imageUpload, mongo, db);

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static IMongoContext CreateMongoWithNutritionPlan(NutritionPlan? plan = null)
    {
        var mongo = Substitute.For<IMongoContext>();

        var plans = plan is not null ? new List<NutritionPlan> { plan } : new List<NutritionPlan>();
        var planCollection = PlanTestHelpers.CreateMockMongo(plans.ToArray()).NutritionPlans;
        mongo.NutritionPlans.Returns(planCollection);

        var emptyTrainingCollection = CreateEmptyTrainingCollection();
        mongo.TrainingPlans.Returns(emptyTrainingCollection);

        return mongo;
    }

    private static IMongoContext CreateMongoWithTrainingPlan(TrainingPlan? plan = null)
    {
        var mongo = Substitute.For<IMongoContext>();

        var emptyNutrition = PlanTestHelpers.CreateMockMongo(Array.Empty<NutritionPlan>()).NutritionPlans;
        mongo.NutritionPlans.Returns(emptyNutrition);

        var plans = plan is not null ? new List<TrainingPlan> { plan } : new List<TrainingPlan>();
        var trainingCollection = CreateTrainingCollection(plans);
        mongo.TrainingPlans.Returns(trainingCollection);

        return mongo;
    }

    private static IMongoCollection<TrainingPlan> CreateEmptyTrainingCollection() =>
        CreateTrainingCollection([]);

    private static IMongoCollection<TrainingPlan> CreateTrainingCollection(List<TrainingPlan> plans)
    {
        var collection = Substitute.For<IMongoCollection<TrainingPlan>>();
        collection.FindAsync(
                Arg.Any<FilterDefinition<TrainingPlan>>(),
                Arg.Any<FindOptions<TrainingPlan, TrainingPlan>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                var cursor = Substitute.For<IAsyncCursor<TrainingPlan>>();
                var moved = false;
                cursor.Current.Returns(plans);
                cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
                {
                    if (moved) return false;
                    moved = true;
                    return plans.Count > 0;
                });
                return cursor;
            });
        return collection;
    }

    // ── Happy-path: nutrition plan ────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NutritionPlanExists_Returns200WithPlanPhotoPrefix()
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(externalId: planId, clientId: _clientId);
        var mongo = CreateMongoWithNutritionPlan(plan);
        var db = CreateMockDb();

        _imageUpload
            .GenerateUploadUrlAsync(
                ImageUploadScope.PlanPhoto,
                Arg.Is<string>(s => s.StartsWith($"{planId}/") && s.EndsWith(".jpg")),
                "image/jpeg",
                2048,
                Arg.Any<CancellationToken>())
            .Returns(new BlobUploadUrl("https://storage/upload?token=abc", $"plan-photos/{planId}/photo.jpg"));

        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new GeneratePlanPhotoUploadUrlRequest
        {
            PlanId = planId,
            ContentType = "image/jpeg",
            SizeBytes = 2048
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.UploadUrl.Should().Be("https://storage/upload?token=abc");
        ep.Response.BlobUrl.Should().Contain(planId.ToString());
    }

    // ── Happy-path: training plan fallback ────────────────────────────────────

    [Fact]
    public async Task HandleAsync_TrainingPlanFallback_Returns200()
    {
        var planId = Guid.NewGuid();
        var trainingPlan = new TrainingPlan
        {
            ExternalId = planId,
            ClientId = _clientId,
            Status = TrainingPlanStatus.Active
        };

        var mongo = CreateMongoWithTrainingPlan(trainingPlan);
        var db = CreateMockDb();

        _imageUpload
            .GenerateUploadUrlAsync(
                ImageUploadScope.PlanPhoto,
                Arg.Any<string>(),
                "image/jpeg",
                1024,
                Arg.Any<CancellationToken>())
            .Returns(new BlobUploadUrl("https://storage/upload?token=xyz", $"plan-photos/{planId}/x.jpg"));

        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new GeneratePlanPhotoUploadUrlRequest
        {
            PlanId = planId,
            ContentType = "image/jpeg",
            SizeBytes = 1024
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    // ── Not-found: neither plan exists ───────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NoPlanExists_Returns404()
    {
        var mongo = CreateMongoWithNutritionPlan(null);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new GeneratePlanPhotoUploadUrlRequest
        {
            PlanId = Guid.NewGuid(),
            ContentType = "image/jpeg",
            SizeBytes = 1024
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    // ── Not-found: no client profile ─────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NoClientProfile_Returns404()
    {
        var mongo = CreateMongoWithNutritionPlan(null);
        var db = new MockDbBuilder().Build(); // empty DB — no ClientProfile
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new GeneratePlanPhotoUploadUrlRequest
        {
            PlanId = Guid.NewGuid(),
            ContentType = "image/jpeg",
            SizeBytes = 1024
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    // ── Extension variants ───────────────────────────────────────────────────

    [Theory]
    [InlineData("image/jpeg", "jpg")]
    [InlineData("image/png", "png")]
    [InlineData("image/webp", "webp")]
    [InlineData("image/heic", "heic")]
    public async Task HandleAsync_AllowedContentTypes_ReturnCorrectExtension(
        string contentType, string expectedExt)
    {
        var planId = Guid.NewGuid();
        var plan = PlanTestHelpers.CreatePlan(externalId: planId, clientId: _clientId);
        var mongo = CreateMongoWithNutritionPlan(plan);
        var db = CreateMockDb();

        _imageUpload
            .GenerateUploadUrlAsync(
                ImageUploadScope.PlanPhoto,
                Arg.Is<string>(s => s.EndsWith($".{expectedExt}")),
                contentType,
                1024,
                Arg.Any<CancellationToken>())
            .Returns(new BlobUploadUrl(
                "https://storage/upload?token=ext",
                $"plan-photos/{planId}/photo.{expectedExt}"));

        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new GeneratePlanPhotoUploadUrlRequest
        {
            PlanId = planId,
            ContentType = contentType,
            SizeBytes = 1024
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.BlobUrl.Should().EndWith($".{expectedExt}");
    }
}
