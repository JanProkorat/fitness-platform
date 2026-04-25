using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientNutrition.GenerateMealPhotoUploadUrl;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.NutritionPlans;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace FitnessPlatform.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Tests for <see cref="GenerateMealPhotoUploadUrlEndpoint"/>.
/// </summary>
public class GenerateMealPhotoUploadUrlEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly IImageUploadService _imageUpload = Substitute.For<IImageUploadService>();

    private IApplicationDbContext CreateMockDb() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

    private GenerateMealPhotoUploadUrlEndpoint CreateEndpoint(
        IMongoContext mongo,
        IApplicationDbContext db,
        Guid? callerUserId = null) =>
        Factory.Create<GenerateMealPhotoUploadUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(callerUserId ?? _clientId, AppRoles.Client))),
            _imageUpload, mongo, db);

    // ──────────────────────────────────────────────────────────────────────────
    // Happy-path tests
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_ValidRequest_ReturnsUploadUrlWithDiaryPrefix()
    {
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood(foodName: "Avocado Toast");
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, kind: MealKind.Breakfast, foods: food);

        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);
        plan.Weeks[0].Days[0].Meals.Add(meal);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var db = CreateMockDb();

        _imageUpload
            .GenerateUploadUrlAsync(
                ImageUploadScope.Diary,
                Arg.Is<string>(s => s.StartsWith($"{mealId}/") && s.EndsWith(".jpg")),
                "image/jpeg",
                2048,
                Arg.Any<CancellationToken>())
            .Returns(ci => new BlobUploadUrl(
                "https://storage/upload?token=abc",
                $"diary/{ci.ArgAt<string>(1)}"));

        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new GenerateMealPhotoUploadUrlRequest
        {
            MealId = mealId,
            ContentType = "image/jpeg",
            SizeBytes = 2048
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.UploadUrl.Should().Be("https://storage/upload?token=abc");
        ep.Response.BlobUrl.Should().StartWith($"diary/{mealId}/");
        ep.Response.BlobUrl.Should().EndWith(".jpg");
    }

    [Theory]
    [InlineData("image/jpeg", "jpg")]
    [InlineData("image/png", "png")]
    [InlineData("image/webp", "webp")]
    [InlineData("image/heic", "heic")]
    public async Task HandleAsync_AllowedContentTypes_CallServiceWithDiaryScopeAndCorrectExtension(
        string contentType, string expectedExt)
    {
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood();
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, foods: food);

        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);
        plan.Weeks[0].Days[0].Meals.Add(meal);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var db = CreateMockDb();

        _imageUpload
            .GenerateUploadUrlAsync(
                Arg.Any<ImageUploadScope>(),
                Arg.Any<string>(),
                Arg.Any<string>(),
                Arg.Any<long>(),
                Arg.Any<CancellationToken>())
            .Returns(ci => new BlobUploadUrl(
                "https://storage/upload",
                $"diary/{ci.ArgAt<string>(1)}"));

        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new GenerateMealPhotoUploadUrlRequest
        {
            MealId = mealId,
            ContentType = contentType,
            SizeBytes = 512
        }, TestContext.Current.CancellationToken);

        await _imageUpload.Received(1).GenerateUploadUrlAsync(
            ImageUploadScope.Diary,
            Arg.Is<string>(s => s.StartsWith($"{mealId}/") && s.EndsWith($".{expectedExt}")),
            contentType,
            512,
            Arg.Any<CancellationToken>());
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Not-found / ownership tests
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_MealNotInPlan_Returns404()
    {
        // Plan exists but has no meals, so any mealId will be unknown
        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new GenerateMealPhotoUploadUrlRequest
        {
            MealId = Guid.NewGuid(),
            ContentType = "image/jpeg",
            SizeBytes = 1024
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
        await _imageUpload.DidNotReceive().GenerateUploadUrlAsync(
            Arg.Any<ImageUploadScope>(),
            Arg.Any<string>(),
            Arg.Any<string>(),
            Arg.Any<long>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_UnauthorizedClient_Returns403ViaNoActivePlan()
    {
        // Caller has a client profile, but no active plan is visible to them —
        // identical to the "unrelated client" pattern in AttachMealPhotosEndpointTests.
        var mongo = PlanTestHelpers.CreateMockMongo(plans: []); // no plan for _clientId
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(new GenerateMealPhotoUploadUrlRequest
        {
            MealId = Guid.NewGuid(),
            ContentType = "image/jpeg",
            SizeBytes = 1024
        }, TestContext.Current.CancellationToken);

        // 404 is the safe response — no plan visible to this caller
        ep.HttpContext.Response.StatusCode.Should().Be(404);
        await _imageUpload.DidNotReceive().GenerateUploadUrlAsync(
            Arg.Any<ImageUploadScope>(),
            Arg.Any<string>(),
            Arg.Any<string>(),
            Arg.Any<long>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NoUserClaims_Returns401()
    {
        var mongo = PlanTestHelpers.CreateMockMongo(plans: []);
        var db = CreateMockDb();

        // Create endpoint with no claims principal (unauthenticated)
        var ep = Factory.Create<GenerateMealPhotoUploadUrlEndpoint>(_imageUpload, mongo, db);

        await ep.HandleAsync(new GenerateMealPhotoUploadUrlRequest
        {
            MealId = Guid.NewGuid(),
            ContentType = "image/jpeg",
            SizeBytes = 1024
        }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
        await _imageUpload.DidNotReceive().GenerateUploadUrlAsync(
            Arg.Any<ImageUploadScope>(),
            Arg.Any<string>(),
            Arg.Any<string>(),
            Arg.Any<long>(),
            Arg.Any<CancellationToken>());
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Service-level validation errors propagated to caller
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_UnsupportedContentType_ServiceThrows_PropagatesException()
    {
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood();
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, foods: food);

        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);
        plan.Weeks[0].Days[0].Meals.Add(meal);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var db = CreateMockDb();

        _imageUpload
            .GenerateUploadUrlAsync(
                Arg.Any<ImageUploadScope>(),
                Arg.Any<string>(),
                "application/pdf",
                Arg.Any<long>(),
                Arg.Any<CancellationToken>())
            .Throws(new ValidationFailureException(
                [new FluentValidation.Results.ValidationFailure("contentType", "invalid")
                    { ErrorCode = ErrorCodes.InvalidImageContentType }],
                "Invalid content type."));

        var ep = CreateEndpoint(mongo, db);

        var act = () => ep.HandleAsync(new GenerateMealPhotoUploadUrlRequest
        {
            MealId = mealId,
            ContentType = "application/pdf",
            SizeBytes = 1024
        }, TestContext.Current.CancellationToken);

        var ex = await act.Should().ThrowAsync<ValidationFailureException>();
        ex.Which.Failures.Should()
            .ContainSingle(f => f.ErrorCode == ErrorCodes.InvalidImageContentType);
    }

    [Fact]
    public async Task HandleAsync_SizeTooLarge_ServiceThrows_PropagatesException()
    {
        var mealId = Guid.NewGuid();
        var food = PlanTestHelpers.CreateMealFood();
        var meal = PlanTestHelpers.CreateMeal(mealId: mealId, foods: food);

        var plan = PlanTestHelpers.CreatePlan(clientId: _clientId, status: NutritionPlanStatus.Active);
        plan.Weeks[0].Days[0].Meals.Add(meal);

        var mongo = PlanTestHelpers.CreateMockMongo(plans: [plan]);
        var db = CreateMockDb();

        const long elevenMb = 11L * 1024 * 1024;

        _imageUpload
            .GenerateUploadUrlAsync(
                Arg.Any<ImageUploadScope>(),
                Arg.Any<string>(),
                "image/jpeg",
                elevenMb,
                Arg.Any<CancellationToken>())
            .Throws(new ValidationFailureException(
                [new FluentValidation.Results.ValidationFailure("sizeBytes", "too large")
                    { ErrorCode = ErrorCodes.ImageTooLarge }],
                "Image too large."));

        var ep = CreateEndpoint(mongo, db);

        var act = () => ep.HandleAsync(new GenerateMealPhotoUploadUrlRequest
        {
            MealId = mealId,
            ContentType = "image/jpeg",
            SizeBytes = elevenMb
        }, TestContext.Current.CancellationToken);

        var ex = await act.Should().ThrowAsync<ValidationFailureException>();
        ex.Which.Failures.Should()
            .ContainSingle(f => f.ErrorCode == ErrorCodes.ImageTooLarge);
    }
}
