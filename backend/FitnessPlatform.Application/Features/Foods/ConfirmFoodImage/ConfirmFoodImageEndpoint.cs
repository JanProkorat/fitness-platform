using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Foods.ConfirmFoodImage;

/// <summary>
/// Persists the food image blob URL on the food document.
/// Main slot overwrites <c>ImageUrl</c>. Gallery slot appends to <c>GalleryImageUrls</c> (cap = 6).
/// Only the nutritionist who created the food can set its images.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class ConfirmFoodImageEndpoint(IMongoContext mongo) : Endpoint<ConfirmFoodImageRequest>
{
    private const int GalleryCap = 6;

    /// <inheritdoc />
    public override void Configure()
    {
        Put("/foods/{FoodId}/image");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Confirm food image upload";
            s.Description = "Sets the image URL on the food document after a successful blob upload. "
                            + "Pass the blobUrl returned by POST /foods/{id}/image/upload-url. "
                            + "Use slot=main to set the main image (overwrites); slot=gallery to append "
                            + "to the gallery (max 6 entries). "
                            + "Only the nutritionist who created the food can confirm its images.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(ConfirmFoodImageRequest req, CancellationToken ct)
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
            this.ThrowErrorWithCode(ErrorCodes.FoodNotOwned, "You can only set the image on your own custom foods.");
            return;
        }

        var isGallery = req.Slot.Equals("gallery", StringComparison.OrdinalIgnoreCase);

        UpdateDefinition<Food> update;

        if (isGallery)
        {
            // Re-check gallery cap at confirm time (race: another confirm could have filled it
            // between the upload-url call and this confirm call).
            if (food.GalleryImageUrls.Count >= GalleryCap)
            {
                this.ThrowErrorWithCode(ErrorCodes.FoodGalleryFull,
                    $"The food gallery is full. Maximum {GalleryCap} gallery images are allowed.");
                return;
            }

            update = Builders<Food>.Update
                .Push(f => f.GalleryImageUrls, req.BlobUrl)
                .Set(f => f.DateUpdated, DateTime.UtcNow);
        }
        else
        {
            update = Builders<Food>.Update
                .Set(f => f.ImageUrl, req.BlobUrl)
                .Set(f => f.DateUpdated, DateTime.UtcNow);
        }

        // Guard against a concurrent soft-delete between the FindAsync above and this
        // write: include IsDeleted == false in the update filter so a logically-deleted
        // food never has its image written, even if it slipped past the find gate.
        await mongo.Foods.UpdateOneAsync(
            Builders<Food>.Filter.Eq(f => f.ExternalId, req.FoodId)
                & Builders<Food>.Filter.Eq(f => f.IsDeleted, false),
            update,
            cancellationToken: ct);

        await Send.NoContentAsync(ct);
    }
}
