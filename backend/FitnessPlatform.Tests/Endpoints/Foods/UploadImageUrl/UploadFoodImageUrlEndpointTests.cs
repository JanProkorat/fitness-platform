using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Foods.ConfirmFoodImage;
using FitnessPlatform.Application.Features.Foods.UploadImageUrl;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Endpoints;
using FitnessPlatform.Tests.Endpoints.Foods;
using MongoDB.Driver;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace FitnessPlatform.Tests.Endpoints.Foods.UploadImageUrl;

/// <summary>
/// Tests for <see cref="UploadFoodImageUrlEndpoint"/> and <see cref="ConfirmFoodImageEndpoint"/>.
/// </summary>
public class UploadFoodImageUrlEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();
    private readonly IImageUploadService _imageUpload = Substitute.For<IImageUploadService>();

    // ── Happy path: upload URL — main slot ─────────────────────────────────

    [Fact]
    public async Task UploadUrl_MainSlot_Nutritionist_FoodExists_ReturnsUploadUrlAndBlobUrl()
    {
        var foodId = Guid.NewGuid();
        var food = FoodTestHelpers.CreateFood(externalId: foodId, nutritionistId: _nutritionistId);
        var mongo = FoodTestHelpers.CreateMockMongo(food);

        var expectedBlobUrl = $"foods/{foodId}.jpg";
        _imageUpload
            .GenerateUploadUrlAsync(
                ImageUploadScope.Food,
                $"{foodId}.jpg",
                "image/jpeg",
                1024,
                Arg.Any<CancellationToken>())
            .Returns(new BlobUploadUrl("https://storage/upload?token=abc", expectedBlobUrl));

        var ep = Factory.Create<UploadFoodImageUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, _imageUpload);

        await ep.HandleAsync(new UploadFoodImageUrlRequest
        {
            FoodId = foodId,
            Slot = "main",
            ContentType = "image/jpeg",
            SizeBytes = 1024
        }, CancellationToken.None);

        ep.Response.UploadUrl.Should().Be("https://storage/upload?token=abc");
        ep.Response.BlobUrl.Should().Be(expectedBlobUrl);
        ep.Response.BlobUrl.Should().Be($"foods/{foodId}.jpg");
    }

    // ── Happy path: upload URL — gallery slot (0th entry) ──────────────────

    [Fact]
    public async Task UploadUrl_GallerySlot_EmptyGallery_ReturnsGallery0BlobUrl()
    {
        var foodId = Guid.NewGuid();
        var food = FoodTestHelpers.CreateFood(externalId: foodId, nutritionistId: _nutritionistId);
        // Empty gallery by default
        var mongo = FoodTestHelpers.CreateMockMongo(food);

        var expectedBlobUrl = $"foods/{foodId}/gallery-0.jpg";
        _imageUpload
            .GenerateUploadUrlAsync(
                ImageUploadScope.Food,
                $"{foodId}/gallery-0.jpg",
                "image/jpeg",
                2048,
                Arg.Any<CancellationToken>())
            .Returns(new BlobUploadUrl("https://storage/upload?token=xyz", expectedBlobUrl));

        var ep = Factory.Create<UploadFoodImageUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, _imageUpload);

        await ep.HandleAsync(new UploadFoodImageUrlRequest
        {
            FoodId = foodId,
            Slot = "gallery",
            ContentType = "image/jpeg",
            SizeBytes = 2048
        }, CancellationToken.None);

        ep.Response.BlobUrl.Should().Be($"foods/{foodId}/gallery-0.jpg");
    }

    // ── Gallery slot: next index based on existing count ───────────────────

    [Fact]
    public async Task UploadUrl_GallerySlot_ExistingEntries_UsesCorrectIndex()
    {
        var foodId = Guid.NewGuid();
        var food = FoodTestHelpers.CreateFood(externalId: foodId, nutritionistId: _nutritionistId);
        food.GalleryImageUrls.Add($"foods/{foodId}/gallery-0.jpg");
        food.GalleryImageUrls.Add($"foods/{foodId}/gallery-1.png");
        var mongo = FoodTestHelpers.CreateMockMongo(food);

        _imageUpload
            .GenerateUploadUrlAsync(
                ImageUploadScope.Food,
                $"{foodId}/gallery-2.webp",
                "image/webp",
                512,
                Arg.Any<CancellationToken>())
            .Returns(new BlobUploadUrl("https://storage/upload", $"foods/{foodId}/gallery-2.webp"));

        var ep = Factory.Create<UploadFoodImageUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, _imageUpload);

        await ep.HandleAsync(new UploadFoodImageUrlRequest
        {
            FoodId = foodId,
            Slot = "gallery",
            ContentType = "image/webp",
            SizeBytes = 512
        }, CancellationToken.None);

        await _imageUpload.Received(1).GenerateUploadUrlAsync(
            ImageUploadScope.Food,
            $"{foodId}/gallery-2.webp",
            "image/webp",
            512,
            Arg.Any<CancellationToken>());
    }

    // ── Gallery cap enforcement on upload ──────────────────────────────────

    [Fact]
    public async Task UploadUrl_GallerySlot_GalleryFull_Throws_FoodGalleryFull()
    {
        var foodId = Guid.NewGuid();
        var food = FoodTestHelpers.CreateFood(externalId: foodId, nutritionistId: _nutritionistId);
        // Fill gallery to cap
        for (var i = 0; i < 6; i++)
            food.GalleryImageUrls.Add($"foods/{foodId}/gallery-{i}.jpg");

        var mongo = FoodTestHelpers.CreateMockMongo(food);

        var ep = Factory.Create<UploadFoodImageUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, _imageUpload);

        var act = () => ep.HandleAsync(new UploadFoodImageUrlRequest
        {
            FoodId = foodId,
            Slot = "gallery",
            ContentType = "image/jpeg",
            SizeBytes = 1024
        }, CancellationToken.None);

        var ex = await act.Should().ThrowAsync<ValidationFailureException>();
        ex.Which.Failures.Should()
            .ContainSingle(f => f.ErrorCode == ErrorCodes.FoodGalleryFull);

        await _imageUpload.DidNotReceive().GenerateUploadUrlAsync(
            Arg.Any<ImageUploadScope>(), Arg.Any<string>(), Arg.Any<string>(),
            Arg.Any<long>(), Arg.Any<CancellationToken>());
    }

    // ── Non-owner ──────────────────────────────────────────────────────────

    [Fact]
    public async Task UploadUrl_NonOwner_Throws_FoodNotOwned()
    {
        var foodId = Guid.NewGuid();
        var food = FoodTestHelpers.CreateFood(externalId: foodId, nutritionistId: Guid.NewGuid()); // different owner
        var mongo = FoodTestHelpers.CreateMockMongo(food);

        var ep = Factory.Create<UploadFoodImageUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, _imageUpload);

        var act = () => ep.HandleAsync(new UploadFoodImageUrlRequest
        {
            FoodId = foodId,
            Slot = "main",
            ContentType = "image/jpeg",
            SizeBytes = 1024
        }, CancellationToken.None);

        var ex = await act.Should().ThrowAsync<ValidationFailureException>();
        ex.Which.Failures.Should()
            .ContainSingle(f => f.ErrorCode == ErrorCodes.FoodNotOwned);

        await _imageUpload.DidNotReceive().GenerateUploadUrlAsync(
            Arg.Any<ImageUploadScope>(), Arg.Any<string>(), Arg.Any<string>(),
            Arg.Any<long>(), Arg.Any<CancellationToken>());
    }

    // ── Blob-path format ────────────────────────────────────────────────────

    [Theory]
    [InlineData("image/jpeg", "main",    "{0}.jpg")]
    [InlineData("image/png",  "main",    "{0}.png")]
    [InlineData("image/webp", "main",    "{0}.webp")]
    [InlineData("image/jpeg", "gallery", "{0}/gallery-0.jpg")]
    [InlineData("image/png",  "gallery", "{0}/gallery-0.png")]
    public async Task UploadUrl_SubPathConstruction_MatchesBlobPathConvention(
        string contentType, string slot, string expectedSubPathTemplate)
    {
        var foodId = Guid.NewGuid();
        var food = FoodTestHelpers.CreateFood(externalId: foodId, nutritionistId: _nutritionistId);
        var mongo = FoodTestHelpers.CreateMockMongo(food);

        var expectedSubPath = string.Format(expectedSubPathTemplate, foodId);
        _imageUpload
            .GenerateUploadUrlAsync(
                ImageUploadScope.Food,
                expectedSubPath,
                contentType,
                512,
                Arg.Any<CancellationToken>())
            .Returns(new BlobUploadUrl("https://storage/upload", $"foods/{expectedSubPath}"));

        var ep = Factory.Create<UploadFoodImageUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, _imageUpload);

        await ep.HandleAsync(new UploadFoodImageUrlRequest
        {
            FoodId = foodId,
            Slot = slot,
            ContentType = contentType,
            SizeBytes = 512
        }, CancellationToken.None);

        await _imageUpload.Received(1).GenerateUploadUrlAsync(
            ImageUploadScope.Food,
            expectedSubPath,
            contentType,
            512,
            Arg.Any<CancellationToken>());
    }

    // ── Food not found ──────────────────────────────────────────────────────

    [Fact]
    public async Task UploadUrl_FoodNotFound_Returns404()
    {
        var mongo = FoodTestHelpers.CreateMockMongo(); // no foods

        var ep = Factory.Create<UploadFoodImageUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, _imageUpload);

        await ep.HandleAsync(new UploadFoodImageUrlRequest
        {
            FoodId = Guid.NewGuid(),
            Slot = "main",
            ContentType = "image/jpeg",
            SizeBytes = 1024
        }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
        await _imageUpload.DidNotReceive().GenerateUploadUrlAsync(
            Arg.Any<ImageUploadScope>(),
            Arg.Any<string>(),
            Arg.Any<string>(),
            Arg.Any<long>(),
            Arg.Any<CancellationToken>());
    }

    // ── Unauthenticated ─────────────────────────────────────────────────────

    [Fact]
    public async Task UploadUrl_NoClaims_Returns401()
    {
        var foodId = Guid.NewGuid();
        var food = FoodTestHelpers.CreateFood(externalId: foodId, nutritionistId: _nutritionistId);
        var mongo = FoodTestHelpers.CreateMockMongo(food);

        // No user context set — endpoint now checks UserId claim and returns 401.
        var ep = Factory.Create<UploadFoodImageUrlEndpoint>(mongo, _imageUpload);

        await ep.HandleAsync(new UploadFoodImageUrlRequest
        {
            FoodId = foodId,
            Slot = "main",
            ContentType = "image/jpeg",
            SizeBytes = 1024
        }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
        await _imageUpload.DidNotReceive().GenerateUploadUrlAsync(
            Arg.Any<ImageUploadScope>(),
            Arg.Any<string>(),
            Arg.Any<string>(),
            Arg.Any<long>(),
            Arg.Any<CancellationToken>());
    }

    // ── Service-level rejections ────────────────────────────────────────────

    [Fact]
    public async Task UploadUrl_InvalidContentType_ServiceThrows_PropagatesException()
    {
        var foodId = Guid.NewGuid();
        var food = FoodTestHelpers.CreateFood(externalId: foodId, nutritionistId: _nutritionistId);
        var mongo = FoodTestHelpers.CreateMockMongo(food);

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

        var ep = Factory.Create<UploadFoodImageUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, _imageUpload);

        var act = () => ep.HandleAsync(new UploadFoodImageUrlRequest
        {
            FoodId = foodId,
            Slot = "main",
            ContentType = "application/pdf",
            SizeBytes = 1024
        }, CancellationToken.None);

        var ex = await act.Should().ThrowAsync<ValidationFailureException>();
        ex.Which.Failures.Should()
            .ContainSingle(f => f.ErrorCode == ErrorCodes.InvalidImageContentType);
    }

    [Fact]
    public async Task UploadUrl_Oversize_ServiceThrows_PropagatesException()
    {
        const long sixMb = 6L * 1024 * 1024;

        var foodId = Guid.NewGuid();
        var food = FoodTestHelpers.CreateFood(externalId: foodId, nutritionistId: _nutritionistId);
        var mongo = FoodTestHelpers.CreateMockMongo(food);

        _imageUpload
            .GenerateUploadUrlAsync(
                Arg.Any<ImageUploadScope>(),
                Arg.Any<string>(),
                "image/jpeg",
                sixMb,
                Arg.Any<CancellationToken>())
            .Throws(new ValidationFailureException(
                [new FluentValidation.Results.ValidationFailure("sizeBytes", "too large")
                    { ErrorCode = ErrorCodes.ImageTooLarge }],
                "Image too large."));

        var ep = Factory.Create<UploadFoodImageUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, _imageUpload);

        var act = () => ep.HandleAsync(new UploadFoodImageUrlRequest
        {
            FoodId = foodId,
            Slot = "main",
            ContentType = "image/jpeg",
            SizeBytes = sixMb
        }, CancellationToken.None);

        var ex = await act.Should().ThrowAsync<ValidationFailureException>();
        ex.Which.Failures.Should()
            .ContainSingle(f => f.ErrorCode == ErrorCodes.ImageTooLarge);
    }
}

/// <summary>
/// Tests for <see cref="ConfirmFoodImageEndpoint"/>.
/// </summary>
public class ConfirmFoodImageEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();

    // ── Happy path: main slot ──────────────────────────────────────────────

    [Fact]
    public async Task ConfirmImage_MainSlot_Owner_SetsImageUrlOnFood_Returns204()
    {
        var foodId = Guid.NewGuid();
        var food = FoodTestHelpers.CreateFood(externalId: foodId, nutritionistId: _nutritionistId);
        var mongo = FoodTestHelpers.CreateMockMongo(food);

        var ep = Factory.Create<ConfirmFoodImageEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(new ConfirmFoodImageRequest
        {
            FoodId = foodId,
            Slot = "main",
            BlobUrl = $"foods/{foodId}.jpg"
        }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        await mongo.Foods.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<FitnessPlatform.Application.Domain.Documents.Food>>(),
            Arg.Any<UpdateDefinition<FitnessPlatform.Application.Domain.Documents.Food>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ── Happy path: gallery slot ───────────────────────────────────────────

    [Fact]
    public async Task ConfirmImage_GallerySlot_Owner_AppendsToGallery_Returns204()
    {
        var foodId = Guid.NewGuid();
        var food = FoodTestHelpers.CreateFood(externalId: foodId, nutritionistId: _nutritionistId);
        var mongo = FoodTestHelpers.CreateMockMongo(food);

        var ep = Factory.Create<ConfirmFoodImageEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(new ConfirmFoodImageRequest
        {
            FoodId = foodId,
            Slot = "gallery",
            BlobUrl = $"foods/{foodId}/gallery-0.jpg"
        }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        await mongo.Foods.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<FitnessPlatform.Application.Domain.Documents.Food>>(),
            Arg.Any<UpdateDefinition<FitnessPlatform.Application.Domain.Documents.Food>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ── Gallery cap enforcement on confirm ────────────────────────────────

    [Fact]
    public async Task ConfirmImage_GallerySlot_GalleryFull_Throws_FoodGalleryFull()
    {
        var foodId = Guid.NewGuid();
        var food = FoodTestHelpers.CreateFood(externalId: foodId, nutritionistId: _nutritionistId);
        for (var i = 0; i < 6; i++)
            food.GalleryImageUrls.Add($"foods/{foodId}/gallery-{i}.jpg");

        var mongo = FoodTestHelpers.CreateMockMongo(food);

        var ep = Factory.Create<ConfirmFoodImageEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        var act = () => ep.HandleAsync(new ConfirmFoodImageRequest
        {
            FoodId = foodId,
            Slot = "gallery",
            BlobUrl = $"foods/{foodId}/gallery-6.jpg"
        }, CancellationToken.None);

        var ex = await act.Should().ThrowAsync<ValidationFailureException>();
        ex.Which.Failures.Should()
            .ContainSingle(f => f.ErrorCode == ErrorCodes.FoodGalleryFull);

        await mongo.Foods.DidNotReceive().UpdateOneAsync(
            Arg.Any<FilterDefinition<FitnessPlatform.Application.Domain.Documents.Food>>(),
            Arg.Any<UpdateDefinition<FitnessPlatform.Application.Domain.Documents.Food>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ── Ownership gate ──────────────────────────────────────────────────────

    [Fact]
    public async Task ConfirmImage_NonOwner_ThrowsFoodNotOwnedError()
    {
        var foodId = Guid.NewGuid();
        var food = FoodTestHelpers.CreateFood(externalId: foodId, nutritionistId: Guid.NewGuid()); // different owner
        var mongo = FoodTestHelpers.CreateMockMongo(food);

        var ep = Factory.Create<ConfirmFoodImageEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        var act = () => ep.HandleAsync(new ConfirmFoodImageRequest
        {
            FoodId = foodId,
            Slot = "main",
            BlobUrl = $"foods/{foodId}.jpg"
        }, CancellationToken.None);

        var ex = await act.Should().ThrowAsync<ValidationFailureException>();
        ex.Which.Failures.Should()
            .ContainSingle(f => f.ErrorCode == ErrorCodes.FoodNotOwned);

        await mongo.Foods.DidNotReceive().UpdateOneAsync(
            Arg.Any<FilterDefinition<FitnessPlatform.Application.Domain.Documents.Food>>(),
            Arg.Any<UpdateDefinition<FitnessPlatform.Application.Domain.Documents.Food>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ── Food not found ──────────────────────────────────────────────────────

    [Fact]
    public async Task ConfirmImage_FoodNotFound_Returns404()
    {
        var mongo = FoodTestHelpers.CreateMockMongo(); // no foods

        var ep = Factory.Create<ConfirmFoodImageEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(new ConfirmFoodImageRequest
        {
            FoodId = Guid.NewGuid(),
            Slot = "main",
            BlobUrl = "foods/nonexistent.jpg"
        }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
        await mongo.Foods.DidNotReceive().UpdateOneAsync(
            Arg.Any<FilterDefinition<FitnessPlatform.Application.Domain.Documents.Food>>(),
            Arg.Any<UpdateDefinition<FitnessPlatform.Application.Domain.Documents.Food>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ── Soft-deleted food ───────────────────────────────────────────────────

    /// <summary>
    /// When FindAsync returns no document (because the food is soft-deleted —
    /// the find filter includes IsDeleted == false), the endpoint must return 404
    /// and must not issue an UpdateOneAsync call.
    /// </summary>
    [Fact]
    public async Task ConfirmImage_SoftDeletedFood_FindReturnsNull_Returns404AndUpdateNotCalled()
    {
        var mongo = FoodTestHelpers.CreateMockMongo(); // no foods → FindAsync returns empty cursor

        var ep = Factory.Create<ConfirmFoodImageEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(new ConfirmFoodImageRequest
        {
            FoodId = Guid.NewGuid(),
            Slot = "main",
            BlobUrl = "foods/deleted-food.jpg"
        }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(404,
            "a soft-deleted (or never-existing) food must result in 404, not a write");

        await mongo.Foods.DidNotReceive().UpdateOneAsync(
            Arg.Any<FilterDefinition<FitnessPlatform.Application.Domain.Documents.Food>>(),
            Arg.Any<UpdateDefinition<FitnessPlatform.Application.Domain.Documents.Food>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ── Unauthenticated ─────────────────────────────────────────────────────

    [Fact]
    public async Task ConfirmImage_NoClaims_Returns401()
    {
        var foodId = Guid.NewGuid();
        var food = FoodTestHelpers.CreateFood(externalId: foodId, nutritionistId: _nutritionistId);
        var mongo = FoodTestHelpers.CreateMockMongo(food);

        var ep = Factory.Create<ConfirmFoodImageEndpoint>(mongo);

        await ep.HandleAsync(new ConfirmFoodImageRequest
        {
            FoodId = foodId,
            Slot = "main",
            BlobUrl = $"foods/{foodId}.jpg"
        }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
        await mongo.Foods.DidNotReceive().UpdateOneAsync(
            Arg.Any<FilterDefinition<FitnessPlatform.Application.Domain.Documents.Food>>(),
            Arg.Any<UpdateDefinition<FitnessPlatform.Application.Domain.Documents.Food>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ── Get reflects stored image ───────────────────────────────────────────

    [Fact]
    public void ConfirmImage_AfterConfirm_GetFoodSummary_ReflectsImageUrlAndGallery()
    {
        var foodId = Guid.NewGuid();
        var blobUrl = $"foods/{foodId}.jpg";
        var galleryUrl = $"foods/{foodId}/gallery-0.png";

        // Simulate what happens after both confirms: the food document has both fields set.
        var food = FoodTestHelpers.CreateFood(externalId: foodId, nutritionistId: _nutritionistId);
        food.ImageUrl = blobUrl;
        food.GalleryImageUrls.Add(galleryUrl);

        var summary = FitnessPlatform.Application.Features.Foods.Shared.FoodSummary
            .FromDocument(food, currentUserId: _nutritionistId);

        summary.ImageUrl.Should().Be(blobUrl);
        summary.GalleryImageUrls.Should().ContainSingle(u => u == galleryUrl);
        summary.FoodId.Should().Be(foodId);
    }
}
