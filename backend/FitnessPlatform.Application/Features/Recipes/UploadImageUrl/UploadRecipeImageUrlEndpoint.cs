using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Recipes.UploadImageUrl;

/// <summary>
/// Generates a pre-signed upload URL for a recipe image (main slot or gallery slot).
/// Only the nutritionist who created the recipe can upload images.
/// Gallery is capped at 6 entries; attempting to add a 7th returns 400.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="imageUpload">Image upload service — validates content type and size, then issues the signed URL.</param>
public class UploadRecipeImageUrlEndpoint(IMongoContext mongo, IImageUploadService imageUpload)
    : Endpoint<UploadRecipeImageUrlRequest, UploadRecipeImageUrlResponse>
{
    private const int GalleryCap = 6;

    /// <inheritdoc />
    public override void Configure()
    {
        Post("/recipes/{RecipeId}/image/upload-url");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Generate recipe image upload URL";
            s.Description = "Returns a time-limited pre-signed URL for direct recipe image upload to blob storage, "
                            + "together with the permanent blob URL that should be confirmed via PUT /recipes/{id}/image. "
                            + "Use ?slot=main to overwrite the main image; ?slot=gallery to append to the gallery (max 6 entries). "
                            + "Only the nutritionist who created the recipe can upload its images.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UploadRecipeImageUrlRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        var filter = Builders<Recipe>.Filter.Eq(r => r.ExternalId, req.RecipeId);

        using var cursor = await mongo.Recipes.FindAsync(filter, cancellationToken: ct);
        var recipe = await cursor.FirstOrDefaultAsync(ct);

        if (recipe is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (recipe.NutritionistId != nutritionistId)
        {
            this.ThrowErrorWithCode(ErrorCodes.RecipeNotOwned,
                "You can only upload images for your own recipes.");
            return;
        }

        var isGallery = req.Slot.Equals("gallery", StringComparison.OrdinalIgnoreCase);

        if (isGallery && recipe.GalleryImageUrls.Count >= GalleryCap)
        {
            this.ThrowErrorWithCode(ErrorCodes.RecipeGalleryFull,
                $"The recipe gallery is full. Maximum {GalleryCap} gallery images are allowed.");
            return;
        }

        var extension = GetExtension(req.ContentType);

        // subPath for main: "{recipeId}/main.{ext}"
        // subPath for gallery: "{recipeId}/gallery-{nextIndex}.{ext}"
        var subPath = isGallery
            ? $"{req.RecipeId}/gallery-{recipe.GalleryImageUrls.Count}.{extension}"
            : $"{req.RecipeId}/main.{extension}";

        var result = await imageUpload.GenerateUploadUrlAsync(
            ImageUploadScope.Recipe,
            subPath,
            req.ContentType,
            req.SizeBytes,
            ct);

        await Send.OkAsync(new UploadRecipeImageUrlResponse
        {
            UploadUrl = result.UploadUrl,
            BlobUrl = result.BlobUrl
        }, ct);
    }

    // Returns a file extension for known image types.
    // For unsupported types, returns a placeholder — the IImageUploadService
    // validates the content type and will throw INVALID_IMAGE_CONTENT_TYPE before
    // the subPath value reaches blob storage.
    private static string GetExtension(string contentType) => contentType.ToLowerInvariant() switch
    {
        "image/jpeg" => "jpg",
        "image/png"  => "png",
        "image/webp" => "webp",
        _            => "bin",
    };
}
