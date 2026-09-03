using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientNutrition.GenerateDayPhotoUploadUrl;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace FitnessPlatform.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Tests for <see cref="GenerateDayPhotoUploadUrlEndpoint"/>.
/// </summary>
public class GenerateDayPhotoUploadUrlEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly IImageUploadService _imageUpload = Substitute.For<IImageUploadService>();

    private IApplicationDbContext CreateMockDb() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

    private GenerateDayPhotoUploadUrlEndpoint CreateEndpoint(
        IMongoContext mongo,
        IApplicationDbContext db,
        Guid? callerUserId = null) =>
        Factory.Create<GenerateDayPhotoUploadUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(callerUserId ?? _clientId, AppRoles.Client))),
            _imageUpload, mongo, db, TimeProvider.System);

    // ──────────────────────────────────────────────────────────────────────────
    // Happy-path tests
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_ValidRequest_ReturnsUploadUrlWithPlanPhotoPrefix()
    {
        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var db = CreateMockDb();

        _imageUpload
            .GenerateUploadUrlAsync(
                ImageUploadScope.PlanPhoto,
                Arg.Is<string>(s => s.StartsWith($"{plan.ExternalId}/") && s.EndsWith(".jpg")),
                "image/jpeg",
                2048,
                Arg.Any<CancellationToken>())
            .Returns(ci => new BlobUploadUrl(
                "https://storage/upload?token=abc",
                $"plan-photos/{ci.ArgAt<string>(1)}"));

        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new GenerateDayPhotoUploadUrlRequest
        {
            ContentType = "image/jpeg",
            SizeBytes = 2048
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.UploadUrl.Should().Be("https://storage/upload?token=abc");
        ep.Response.BlobUrl.Should().StartWith($"plan-photos/{plan.ExternalId}/");
        ep.Response.BlobUrl.Should().EndWith(".jpg");
    }

    [Theory]
    [InlineData("image/jpeg", "jpg")]
    [InlineData("image/png", "png")]
    [InlineData("image/webp", "webp")]
    [InlineData("image/heic", "heic")]
    public async Task HandleAsync_AllowedContentTypes_ReturnCorrectExtension(
        string contentType, string expectedExt)
    {
        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);
        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var db = CreateMockDb();

        _imageUpload
            .GenerateUploadUrlAsync(
                ImageUploadScope.PlanPhoto,
                Arg.Is<string>(s => s.EndsWith($".{expectedExt}")),
                contentType,
                1024,
                Arg.Any<CancellationToken>())
            .Returns(ci => new BlobUploadUrl(
                "https://storage/upload?token=xyz",
                $"plan-photos/{ci.ArgAt<string>(1)}"));

        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new GenerateDayPhotoUploadUrlRequest
        {
            ContentType = contentType,
            SizeBytes = 1024
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.BlobUrl.Should().EndWith($".{expectedExt}");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Auth / ownership guard tests
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NoActivePlan_Returns404()
    {
        var mongo = PlanTestHelpers.CreateMockMongo(plans: []);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new GenerateDayPhotoUploadUrlRequest
        {
            ContentType = "image/jpeg",
            SizeBytes = 1024
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClientProfile_Returns404()
    {
        // DB returns no client profile for this user
        var emptyDb = new MockDbBuilder().Build();
        var mongo = PlanTestHelpers.CreateMockMongo(plans: []);
        var ep = CreateEndpoint(mongo, emptyDb);

        await ep.HandleAsync(new GenerateDayPhotoUploadUrlRequest
        {
            ContentType = "image/jpeg",
            SizeBytes = 1024
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
