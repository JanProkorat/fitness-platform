using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Recipes.ConfirmRecipeImage;
using FitnessPlatform.Application.Features.Recipes.UploadImageUrl;
using FitnessPlatform.Tests.Endpoints;
using FitnessPlatform.Tests.Endpoints.Recipes;
using MongoDB.Driver;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace FitnessPlatform.Tests.Endpoints.Recipes.UploadImageUrl;

/// <summary>
/// Unit tests for <see cref="UploadRecipeImageUrlEndpoint"/> and <see cref="ConfirmRecipeImageEndpoint"/>.
/// </summary>
public class UploadRecipeImageUrlEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();
    private readonly IImageUploadService _imageUpload = Substitute.For<IImageUploadService>();

    // ── Happy path: upload URL — main slot ─────────────────────────────────

    [Fact]
    public async Task UploadUrl_MainSlot_Nutritionist_RecipeExists_ReturnsUploadUrlAndBlobUrl()
    {
        var recipeId = Guid.NewGuid();
        var recipe = RecipeTestHelpers.CreateRecipe(externalId: recipeId, nutritionistId: _nutritionistId);
        var mongo = RecipeTestHelpers.CreateMockMongo(recipes: [recipe]);

        var expectedBlobUrl = $"recipes/{recipeId}/main.jpg";
        _imageUpload
            .GenerateUploadUrlAsync(
                ImageUploadScope.Recipe,
                $"{recipeId}/main.jpg",
                "image/jpeg",
                1024,
                Arg.Any<CancellationToken>())
            .Returns(new BlobUploadUrl("https://storage/upload?token=abc", expectedBlobUrl));

        var ep = Factory.Create<UploadRecipeImageUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, _imageUpload);

        await ep.HandleAsync(new UploadRecipeImageUrlRequest
        {
            RecipeId = recipeId,
            Slot = "main",
            ContentType = "image/jpeg",
            SizeBytes = 1024
        }, CancellationToken.None);

        ep.Response.UploadUrl.Should().Be("https://storage/upload?token=abc");
        ep.Response.BlobUrl.Should().Be(expectedBlobUrl);
        ep.Response.BlobUrl.Should().Be($"recipes/{recipeId}/main.jpg");
    }

    // ── Happy path: upload URL — gallery slot (0th entry) ──────────────────

    [Fact]
    public async Task UploadUrl_GallerySlot_EmptyGallery_ReturnsGallery0BlobUrl()
    {
        var recipeId = Guid.NewGuid();
        var recipe = RecipeTestHelpers.CreateRecipe(externalId: recipeId, nutritionistId: _nutritionistId);
        // Empty gallery
        var mongo = RecipeTestHelpers.CreateMockMongo(recipes: [recipe]);

        var expectedBlobUrl = $"recipes/{recipeId}/gallery-0.jpg";
        _imageUpload
            .GenerateUploadUrlAsync(
                ImageUploadScope.Recipe,
                $"{recipeId}/gallery-0.jpg",
                "image/jpeg",
                2048,
                Arg.Any<CancellationToken>())
            .Returns(new BlobUploadUrl("https://storage/upload?token=xyz", expectedBlobUrl));

        var ep = Factory.Create<UploadRecipeImageUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, _imageUpload);

        await ep.HandleAsync(new UploadRecipeImageUrlRequest
        {
            RecipeId = recipeId,
            Slot = "gallery",
            ContentType = "image/jpeg",
            SizeBytes = 2048
        }, CancellationToken.None);

        ep.Response.BlobUrl.Should().Be($"recipes/{recipeId}/gallery-0.jpg");
    }

    // ── Gallery slot: next index based on existing count ───────────────────

    [Fact]
    public async Task UploadUrl_GallerySlot_ExistingEntries_UsesCorrectIndex()
    {
        var recipeId = Guid.NewGuid();
        var recipe = RecipeTestHelpers.CreateRecipe(externalId: recipeId, nutritionistId: _nutritionistId);
        recipe.GalleryImageUrls.Add($"recipes/{recipeId}/gallery-0.jpg");
        recipe.GalleryImageUrls.Add($"recipes/{recipeId}/gallery-1.png");
        var mongo = RecipeTestHelpers.CreateMockMongo(recipes: [recipe]);

        _imageUpload
            .GenerateUploadUrlAsync(
                ImageUploadScope.Recipe,
                $"{recipeId}/gallery-2.webp",
                "image/webp",
                512,
                Arg.Any<CancellationToken>())
            .Returns(new BlobUploadUrl("https://storage/upload", $"recipes/{recipeId}/gallery-2.webp"));

        var ep = Factory.Create<UploadRecipeImageUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, _imageUpload);

        await ep.HandleAsync(new UploadRecipeImageUrlRequest
        {
            RecipeId = recipeId,
            Slot = "gallery",
            ContentType = "image/webp",
            SizeBytes = 512
        }, CancellationToken.None);

        await _imageUpload.Received(1).GenerateUploadUrlAsync(
            ImageUploadScope.Recipe,
            $"{recipeId}/gallery-2.webp",
            "image/webp",
            512,
            Arg.Any<CancellationToken>());
    }

    // ── Gallery cap enforcement on upload ──────────────────────────────────

    [Fact]
    public async Task UploadUrl_GallerySlot_GalleryFull_Throws_RecipeGalleryFull()
    {
        var recipeId = Guid.NewGuid();
        var recipe = RecipeTestHelpers.CreateRecipe(externalId: recipeId, nutritionistId: _nutritionistId);
        // Fill gallery to cap
        for (var i = 0; i < 6; i++)
            recipe.GalleryImageUrls.Add($"recipes/{recipeId}/gallery-{i}.jpg");

        var mongo = RecipeTestHelpers.CreateMockMongo(recipes: [recipe]);

        var ep = Factory.Create<UploadRecipeImageUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, _imageUpload);

        var act = () => ep.HandleAsync(new UploadRecipeImageUrlRequest
        {
            RecipeId = recipeId,
            Slot = "gallery",
            ContentType = "image/jpeg",
            SizeBytes = 1024
        }, CancellationToken.None);

        var ex = await act.Should().ThrowAsync<ValidationFailureException>();
        ex.Which.Failures.Should()
            .ContainSingle(f => f.ErrorCode == ErrorCodes.RecipeGalleryFull);

        await _imageUpload.DidNotReceive().GenerateUploadUrlAsync(
            Arg.Any<ImageUploadScope>(), Arg.Any<string>(), Arg.Any<string>(),
            Arg.Any<long>(), Arg.Any<CancellationToken>());
    }

    // ── Non-owner ──────────────────────────────────────────────────────────

    [Fact]
    public async Task UploadUrl_NonOwner_Throws_RecipeNotOwned()
    {
        var recipeId = Guid.NewGuid();
        var recipe = RecipeTestHelpers.CreateRecipe(externalId: recipeId, nutritionistId: Guid.NewGuid());
        var mongo = RecipeTestHelpers.CreateMockMongo(recipes: [recipe]);

        var ep = Factory.Create<UploadRecipeImageUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, _imageUpload);

        var act = () => ep.HandleAsync(new UploadRecipeImageUrlRequest
        {
            RecipeId = recipeId,
            Slot = "main",
            ContentType = "image/jpeg",
            SizeBytes = 1024
        }, CancellationToken.None);

        var ex = await act.Should().ThrowAsync<ValidationFailureException>();
        ex.Which.Failures.Should()
            .ContainSingle(f => f.ErrorCode == ErrorCodes.RecipeNotOwned);
    }

    // ── Recipe not found ───────────────────────────────────────────────────

    [Fact]
    public async Task UploadUrl_RecipeNotFound_Returns404()
    {
        var mongo = RecipeTestHelpers.CreateMockMongo(); // no recipes

        var ep = Factory.Create<UploadRecipeImageUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, _imageUpload);

        await ep.HandleAsync(new UploadRecipeImageUrlRequest
        {
            RecipeId = Guid.NewGuid(),
            Slot = "main",
            ContentType = "image/jpeg",
            SizeBytes = 1024
        }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
        await _imageUpload.DidNotReceive().GenerateUploadUrlAsync(
            Arg.Any<ImageUploadScope>(), Arg.Any<string>(), Arg.Any<string>(),
            Arg.Any<long>(), Arg.Any<CancellationToken>());
    }

    // ── Unauthenticated ────────────────────────────────────────────────────

    [Fact]
    public async Task UploadUrl_NoClaims_Returns401()
    {
        var recipeId = Guid.NewGuid();
        var recipe = RecipeTestHelpers.CreateRecipe(externalId: recipeId, nutritionistId: _nutritionistId);
        var mongo = RecipeTestHelpers.CreateMockMongo(recipes: [recipe]);

        var ep = Factory.Create<UploadRecipeImageUrlEndpoint>(mongo, _imageUpload);

        await ep.HandleAsync(new UploadRecipeImageUrlRequest
        {
            RecipeId = recipeId,
            Slot = "main",
            ContentType = "image/jpeg",
            SizeBytes = 1024
        }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    // ── Blob-path format ───────────────────────────────────────────────────

    [Theory]
    [InlineData("image/jpeg", "main",    "{0}/main.jpg")]
    [InlineData("image/png",  "main",    "{0}/main.png")]
    [InlineData("image/webp", "main",    "{0}/main.webp")]
    [InlineData("image/jpeg", "gallery", "{0}/gallery-0.jpg")]
    [InlineData("image/png",  "gallery", "{0}/gallery-0.png")]
    public async Task UploadUrl_SubPathConstruction_MatchesBlobPathConvention(
        string contentType, string slot, string expectedSubPathTemplate)
    {
        var recipeId = Guid.NewGuid();
        var recipe = RecipeTestHelpers.CreateRecipe(externalId: recipeId, nutritionistId: _nutritionistId);
        var mongo = RecipeTestHelpers.CreateMockMongo(recipes: [recipe]);

        var expectedSubPath = string.Format(expectedSubPathTemplate, recipeId);
        _imageUpload
            .GenerateUploadUrlAsync(
                ImageUploadScope.Recipe,
                expectedSubPath,
                contentType,
                512,
                Arg.Any<CancellationToken>())
            .Returns(new BlobUploadUrl("https://storage/upload", $"recipes/{expectedSubPath}"));

        var ep = Factory.Create<UploadRecipeImageUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, _imageUpload);

        await ep.HandleAsync(new UploadRecipeImageUrlRequest
        {
            RecipeId = recipeId,
            Slot = slot,
            ContentType = contentType,
            SizeBytes = 512
        }, CancellationToken.None);

        await _imageUpload.Received(1).GenerateUploadUrlAsync(
            ImageUploadScope.Recipe,
            expectedSubPath,
            contentType,
            512,
            Arg.Any<CancellationToken>());
    }

    // ── Service-level rejections ───────────────────────────────────────────

    [Fact]
    public async Task UploadUrl_InvalidContentType_ServiceThrows_PropagatesException()
    {
        var recipeId = Guid.NewGuid();
        var recipe = RecipeTestHelpers.CreateRecipe(externalId: recipeId, nutritionistId: _nutritionistId);
        var mongo = RecipeTestHelpers.CreateMockMongo(recipes: [recipe]);

        _imageUpload
            .GenerateUploadUrlAsync(
                Arg.Any<ImageUploadScope>(), Arg.Any<string>(), "application/pdf",
                Arg.Any<long>(), Arg.Any<CancellationToken>())
            .Throws(new ValidationFailureException(
                [new FluentValidation.Results.ValidationFailure("contentType", "invalid")
                    { ErrorCode = ErrorCodes.InvalidImageContentType }],
                "Invalid content type."));

        var ep = Factory.Create<UploadRecipeImageUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo, _imageUpload);

        var act = () => ep.HandleAsync(new UploadRecipeImageUrlRequest
        {
            RecipeId = recipeId,
            Slot = "main",
            ContentType = "application/pdf",
            SizeBytes = 1024
        }, CancellationToken.None);

        var ex = await act.Should().ThrowAsync<ValidationFailureException>();
        ex.Which.Failures.Should()
            .ContainSingle(f => f.ErrorCode == ErrorCodes.InvalidImageContentType);
    }
}

/// <summary>
/// Unit tests for <see cref="ConfirmRecipeImageEndpoint"/>.
/// </summary>
public class ConfirmRecipeImageEndpointTests
{
    private readonly Guid _nutritionistId = Guid.NewGuid();

    // ── Happy path: main slot ──────────────────────────────────────────────

    [Fact]
    public async Task ConfirmImage_MainSlot_Owner_SetsImageUrl_Returns204()
    {
        var recipeId = Guid.NewGuid();
        var recipe = RecipeTestHelpers.CreateRecipe(externalId: recipeId, nutritionistId: _nutritionistId);
        var mongo = RecipeTestHelpers.CreateMockMongo(recipes: [recipe]);

        var ep = Factory.Create<ConfirmRecipeImageEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(new ConfirmRecipeImageRequest
        {
            RecipeId = recipeId,
            Slot = "main",
            BlobUrl = $"recipes/{recipeId}/main.jpg"
        }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(204);

        await mongo.Recipes.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<Application.Domain.Documents.Recipe>>(),
            Arg.Any<UpdateDefinition<Application.Domain.Documents.Recipe>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ── Happy path: gallery slot ───────────────────────────────────────────

    [Fact]
    public async Task ConfirmImage_GallerySlot_Owner_AppendsToGallery_Returns204()
    {
        var recipeId = Guid.NewGuid();
        var recipe = RecipeTestHelpers.CreateRecipe(externalId: recipeId, nutritionistId: _nutritionistId);
        var mongo = RecipeTestHelpers.CreateMockMongo(recipes: [recipe]);

        var ep = Factory.Create<ConfirmRecipeImageEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(new ConfirmRecipeImageRequest
        {
            RecipeId = recipeId,
            Slot = "gallery",
            BlobUrl = $"recipes/{recipeId}/gallery-0.jpg"
        }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        await mongo.Recipes.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<Application.Domain.Documents.Recipe>>(),
            Arg.Any<UpdateDefinition<Application.Domain.Documents.Recipe>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ── Gallery cap enforcement on confirm ────────────────────────────────

    [Fact]
    public async Task ConfirmImage_GallerySlot_GalleryFull_Throws_RecipeGalleryFull()
    {
        var recipeId = Guid.NewGuid();
        var recipe = RecipeTestHelpers.CreateRecipe(externalId: recipeId, nutritionistId: _nutritionistId);
        for (var i = 0; i < 6; i++)
            recipe.GalleryImageUrls.Add($"recipes/{recipeId}/gallery-{i}.jpg");

        var mongo = RecipeTestHelpers.CreateMockMongo(recipes: [recipe]);

        var ep = Factory.Create<ConfirmRecipeImageEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        var act = () => ep.HandleAsync(new ConfirmRecipeImageRequest
        {
            RecipeId = recipeId,
            Slot = "gallery",
            BlobUrl = $"recipes/{recipeId}/gallery-6.jpg"
        }, CancellationToken.None);

        var ex = await act.Should().ThrowAsync<ValidationFailureException>();
        ex.Which.Failures.Should()
            .ContainSingle(f => f.ErrorCode == ErrorCodes.RecipeGalleryFull);

        await mongo.Recipes.DidNotReceive().UpdateOneAsync(
            Arg.Any<FilterDefinition<Application.Domain.Documents.Recipe>>(),
            Arg.Any<UpdateDefinition<Application.Domain.Documents.Recipe>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ── Ownership gate ─────────────────────────────────────────────────────

    [Fact]
    public async Task ConfirmImage_NonOwner_Throws_RecipeNotOwned()
    {
        var recipeId = Guid.NewGuid();
        var recipe = RecipeTestHelpers.CreateRecipe(externalId: recipeId, nutritionistId: Guid.NewGuid());
        var mongo = RecipeTestHelpers.CreateMockMongo(recipes: [recipe]);

        var ep = Factory.Create<ConfirmRecipeImageEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(Guid.NewGuid(), AppRoles.Nutritionist))),
            mongo);

        var act = () => ep.HandleAsync(new ConfirmRecipeImageRequest
        {
            RecipeId = recipeId,
            Slot = "main",
            BlobUrl = $"recipes/{recipeId}/main.jpg"
        }, CancellationToken.None);

        var ex = await act.Should().ThrowAsync<ValidationFailureException>();
        ex.Which.Failures.Should()
            .ContainSingle(f => f.ErrorCode == ErrorCodes.RecipeNotOwned);

        await mongo.Recipes.DidNotReceive().UpdateOneAsync(
            Arg.Any<FilterDefinition<Application.Domain.Documents.Recipe>>(),
            Arg.Any<UpdateDefinition<Application.Domain.Documents.Recipe>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ── Recipe not found ───────────────────────────────────────────────────

    [Fact]
    public async Task ConfirmImage_RecipeNotFound_Returns404()
    {
        var mongo = RecipeTestHelpers.CreateMockMongo(); // no recipes

        var ep = Factory.Create<ConfirmRecipeImageEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_nutritionistId, AppRoles.Nutritionist))),
            mongo);

        await ep.HandleAsync(new ConfirmRecipeImageRequest
        {
            RecipeId = Guid.NewGuid(),
            Slot = "main",
            BlobUrl = "recipes/nonexistent/main.jpg"
        }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
        await mongo.Recipes.DidNotReceive().UpdateOneAsync(
            Arg.Any<FilterDefinition<Application.Domain.Documents.Recipe>>(),
            Arg.Any<UpdateDefinition<Application.Domain.Documents.Recipe>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ── Unauthenticated ────────────────────────────────────────────────────

    [Fact]
    public async Task ConfirmImage_NoClaims_Returns401()
    {
        var recipeId = Guid.NewGuid();
        var recipe = RecipeTestHelpers.CreateRecipe(externalId: recipeId, nutritionistId: _nutritionistId);
        var mongo = RecipeTestHelpers.CreateMockMongo(recipes: [recipe]);

        var ep = Factory.Create<ConfirmRecipeImageEndpoint>(mongo);

        await ep.HandleAsync(new ConfirmRecipeImageRequest
        {
            RecipeId = recipeId,
            Slot = "main",
            BlobUrl = $"recipes/{recipeId}/main.jpg"
        }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
        await mongo.Recipes.DidNotReceive().UpdateOneAsync(
            Arg.Any<FilterDefinition<Application.Domain.Documents.Recipe>>(),
            Arg.Any<UpdateDefinition<Application.Domain.Documents.Recipe>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ── Get reflects stored image (unit-level) ─────────────────────────────

    [Fact]
    public void ConfirmImage_AfterConfirm_GetRecipe_ReflectsImageUrlAndGallery()
    {
        var recipeId = Guid.NewGuid();
        var blobUrl = $"recipes/{recipeId}/main.jpg";
        var galleryUrl = $"recipes/{recipeId}/gallery-0.png";

        // Simulate what a recipe document looks like after both confirms
        var recipe = RecipeTestHelpers.CreateRecipe(externalId: recipeId, nutritionistId: _nutritionistId);
        recipe.ImageUrl = blobUrl;
        recipe.GalleryImageUrls.Add(galleryUrl);

        var response = Application.Features.Recipes.Shared.GetRecipeResponse.FromDocument(recipe, _nutritionistId);

        response.ImageUrl.Should().Be(blobUrl);
        response.GalleryImageUrls.Should().ContainSingle(u => u == galleryUrl);
        response.RecipeId.Should().Be(recipeId);
    }
}
