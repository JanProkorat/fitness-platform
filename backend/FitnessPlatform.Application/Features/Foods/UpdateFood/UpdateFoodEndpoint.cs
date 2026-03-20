using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Features.Foods.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Foods.UpdateFood;

/// <summary>
/// Updates a custom food item. Only the owning nutritionist can edit.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class UpdateFoodEndpoint(IMongoContext mongo) : Endpoint<UpdateFoodRequest, FoodSummary>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/foods/{FoodId}");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Update custom food";
            s.Description = "Updates a custom food item. Only the nutritionist who created it can edit.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateFoodRequest req, CancellationToken ct)
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
            this.ThrowErrorWithCode(ErrorCodes.FoodNotOwned, "You can only edit your own custom foods.");
            return;
        }

        var localizedNames = (!string.IsNullOrWhiteSpace(req.NameEn) || !string.IsNullOrWhiteSpace(req.NameCs) || !string.IsNullOrWhiteSpace(req.NameDe))
            ? new LocalizedNames
            {
                En = req.NameEn?.Trim().NullIfEmpty(),
                Cs = req.NameCs?.Trim().NullIfEmpty(),
                De = req.NameDe?.Trim().NullIfEmpty(),
            }
            : null;

        var update = Builders<Food>.Update
            .Set(f => f.Name, req.Name.Trim())
            .Set(f => f.LocalizedNames, localizedNames)
            .Set(f => f.Barcode, req.Barcode?.Trim())
            .Set(f => f.NutrientValue, new NutrientValue
            {
                Kcal = req.NutrientValue.Kcal,
                Protein = req.NutrientValue.Protein,
                Carbs = req.NutrientValue.Carbs,
                Fat = req.NutrientValue.Fat,
                Fiber = req.NutrientValue.Fiber,
                Sugar = req.NutrientValue.Sugar,
                SaturatedFat = req.NutrientValue.SaturatedFat,
                Salt = req.NutrientValue.Salt
            })
            .Set(f => f.Allergens, req.Allergens)
            .Set(f => f.CommonServings, req.CommonServings
                .Select(s => new ServingSize { Label = s.Label, WeightGrams = s.WeightGrams })
                .ToList())
            .Set(f => f.DateUpdated, DateTime.UtcNow);

        await mongo.Foods.UpdateOneAsync(
            f => f.ExternalId == req.FoodId,
            update,
            cancellationToken: ct);

        // Re-fetch for response
        using var updatedCursor = await mongo.Foods.FindAsync(
            Builders<Food>.Filter.Eq(f => f.ExternalId, req.FoodId),
            cancellationToken: ct);
        var updated = await updatedCursor.FirstOrDefaultAsync(ct);

        await Send.OkAsync(FoodSummary.FromDocument(updated!), ct);
    }
}
