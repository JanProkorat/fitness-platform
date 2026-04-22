using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Foods.UploadImageUrl;

/// <summary>
/// Generates a pre-signed upload URL for a food item's image.
/// Only the nutritionist who created the food can upload an image.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="imageUpload">Image upload service — validates content type and size, then issues the signed URL.</param>
public class UploadFoodImageUrlEndpoint(IMongoContext mongo, IImageUploadService imageUpload)
    : Endpoint<UploadFoodImageUrlRequest, UploadFoodImageUrlResponse>
{
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
                            + "Only the nutritionist who created the food can upload its image.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UploadFoodImageUrlRequest req, CancellationToken ct)
    {
        var filter = Builders<Food>.Filter.Eq(f => f.ExternalId, req.FoodId)
            & Builders<Food>.Filter.Eq(f => f.IsDeleted, false);

        using var cursor = await mongo.Foods.FindAsync(filter, cancellationToken: ct);
        var food = await cursor.FirstOrDefaultAsync(ct);

        if (food is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var extension = GetExtension(req.ContentType);
        var subPath = $"{req.FoodId}.{extension}";

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
