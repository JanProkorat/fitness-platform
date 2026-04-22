using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Recipes.ConfirmRecipeImage;

/// <summary>
/// Persists the recipe image blob URL on the recipe document.
/// Main slot overwrites <c>ImageUrl</c>. Gallery slot appends to <c>GalleryImageUrls</c> (cap = 6).
/// Only the nutritionist who created the recipe can set its images.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class ConfirmRecipeImageEndpoint(IMongoContext mongo) : Endpoint<ConfirmRecipeImageRequest>
{
    private const int GalleryCap = 6;

    /// <inheritdoc />
    public override void Configure()
    {
        Put("/recipes/{RecipeId}/image");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Confirm recipe image upload";
            s.Description = "Sets the image URL on the recipe document after a successful blob upload. "
                            + "Pass the blobUrl returned by POST /recipes/{id}/image/upload-url. "
                            + "Use slot=main to set the main image (overwrites); slot=gallery to append "
                            + "to the gallery (max 6 entries). "
                            + "Only the nutritionist who created the recipe can confirm its images.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(ConfirmRecipeImageRequest req, CancellationToken ct)
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
                "You can only set images on your own recipes.");
            return;
        }

        var isGallery = req.Slot.Equals("gallery", StringComparison.OrdinalIgnoreCase);

        UpdateDefinition<Recipe> update;

        if (isGallery)
        {
            // Re-check gallery cap at confirm time (race: another confirm could have filled it
            // between the upload-url call and this confirm call).
            if (recipe.GalleryImageUrls.Count >= GalleryCap)
            {
                this.ThrowErrorWithCode(ErrorCodes.RecipeGalleryFull,
                    $"The recipe gallery is full. Maximum {GalleryCap} gallery images are allowed.");
                return;
            }

            update = Builders<Recipe>.Update
                .Push(r => r.GalleryImageUrls, req.BlobUrl)
                .Set(r => r.DateUpdated, DateTime.UtcNow);
        }
        else
        {
            update = Builders<Recipe>.Update
                .Set(r => r.ImageUrl, req.BlobUrl)
                .Set(r => r.DateUpdated, DateTime.UtcNow);
        }

        // Guard against a concurrent delete between the FindAsync above and this
        // write: include ownership filter in the update so a race that removed or
        // reassigned the recipe cannot cause a write to a no-longer-owned document.
        await mongo.Recipes.UpdateOneAsync(
            Builders<Recipe>.Filter.Eq(r => r.ExternalId, req.RecipeId)
                & Builders<Recipe>.Filter.Eq(r => r.NutritionistId, nutritionistId),
            update,
            cancellationToken: ct);

        await Send.NoContentAsync(ct);
    }
}
