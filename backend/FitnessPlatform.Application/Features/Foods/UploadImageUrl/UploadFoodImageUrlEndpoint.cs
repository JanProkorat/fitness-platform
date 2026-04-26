using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Foods.UploadImageUrl;

/// <summary>
/// Generates a pre-signed upload URL for a food item's image (main slot or gallery slot).
/// Only the nutritionist who created the food can upload images.
/// Gallery is capped at 6 entries; attempting to add a 7th returns 400.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="imageUpload">Image upload service — validates content type and size, then issues the signed URL.</param>
public class UploadFoodImageUrlEndpoint(IMongoContext mongo, IImageUploadService imageUpload)
    : Endpoint<UploadFoodImageUrlRequest, UploadFoodImageUrlResponse>
{
    private const int GalleryCap = 6;

    /// <inheritdoc />
    public override void Configure()
    {
        Post("/foods/{FoodId}/image/upload-url");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Generate food image upload URL";
            s.Description = "Returns a time-limited pre-signed URL for direct food image upload to blob storage, "
                            + "together with the permanent blob URL that should be confirmed via PUT /foods/{id}/image. "
                            + "Use ?slot=main to overwrite the main image; ?slot=gallery to append to the gallery (max 6 entries). "
                            + "Only the nutritionist who created the food can upload its images.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UploadFoodImageUrlRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        var filter = Builders<Food>.Filter.Eq(f => f.ExternalId, req.FoodId)
            & Builders<Food>.Filter.Eq(f => f.IsDeleted, false);

        using var cursor = await mongo.Foods.FindAsync(filter, cancellationToken: ct);
        var food = await cursor.FirstOrDefaultAsync(ct);

        if (food is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (food.NutritionistId != nutritionistId)
        {
            this.ThrowErrorWithCode(ErrorCodes.FoodNotOwned,
                "You can only upload images for your own custom foods.");
            return;
        }

        var isGallery = req.Slot.Equals("gallery", StringComparison.OrdinalIgnoreCase);

        if (isGallery && food.GalleryImageUrls.Count >= GalleryCap)
        {
            this.ThrowErrorWithCode(ErrorCodes.FoodGalleryFull,
                $"The food gallery is full. Maximum {GalleryCap} gallery images are allowed.");
            return;
        }

        var extension = GetExtension(req.ContentType);

        // subPath for main: "{foodId}.{ext}"   (preserves existing main-image URL convention)
        // subPath for gallery: "{foodId}/gallery-{nextIndex}.{ext}"
        var subPath = isGallery
            ? $"{req.FoodId}/gallery-{food.GalleryImageUrls.Count}.{extension}"
            : $"{req.FoodId}.{extension}";

        var result = await imageUpload.GenerateUploadUrlAsync(
            ImageUploadScope.Food,
            subPath,
            req.ContentType,
            req.SizeBytes,
            ct);

        await Send.OkAsync(new UploadFoodImageUrlResponse
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
