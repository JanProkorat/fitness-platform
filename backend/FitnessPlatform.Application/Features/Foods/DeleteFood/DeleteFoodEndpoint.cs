using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Foods.DeleteFood;

/// <summary>
/// Soft-deletes a custom food item. Only the owning nutritionist can delete.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class DeleteFoodEndpoint(IMongoContext mongo) : Endpoint<DeleteFoodRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/foods/{FoodId}");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Delete custom food";
            s.Description = "Soft-deletes a custom food item. Only the nutritionist who created it can delete.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeleteFoodRequest req, CancellationToken ct)
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
            this.ThrowErrorWithCode(ErrorCodes.FoodNotOwned, "You can only delete your own custom foods.");
            return;
        }

        var update = Builders<Food>.Update
            .Set(f => f.IsDeleted, true)
            .Set(f => f.DateUpdated, DateTime.UtcNow);

        await mongo.Foods.UpdateOneAsync(
            f => f.ExternalId == req.FoodId,
            update,
            cancellationToken: ct);

        await Send.NoContentAsync(ct);
    }
}
