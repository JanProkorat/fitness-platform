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
/// Only the nutritionist who created the food can set its image.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class ConfirmFoodImageEndpoint(IMongoContext mongo) : Endpoint<ConfirmFoodImageRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/foods/{FoodId}/image");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Confirm food image upload";
            s.Description = "Sets the ImageUrl on the food document after a successful blob upload. "
                            + "Pass the blobUrl returned by POST /foods/{id}/image/upload-url. "
                            + "Only the nutritionist who created the food can confirm its image.";
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

        var update = Builders<Food>.Update
            .Set(f => f.ImageUrl, req.BlobUrl)
            .Set(f => f.DateUpdated, DateTime.UtcNow);

        await mongo.Foods.UpdateOneAsync(
            Builders<Food>.Filter.Eq(f => f.ExternalId, req.FoodId),
            update,
            cancellationToken: ct);

        await Send.NoContentAsync(ct);
    }
}
