using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Foods.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Foods.GetFood;

/// <summary>
/// Retrieves a single food item by its external ID.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class GetFoodEndpoint(IMongoContext mongo) : Endpoint<GetFoodRequest, FoodSummary>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/foods/{FoodId}");
        Summary(s =>
        {
            s.Summary = "Get food by ID";
            s.Description = "Returns a single food item by its public identifier. "
                + "Private foods are only accessible to their creator; other nutritionists receive 404. "
                + "Clients can still read private foods referenced by their nutrition plans.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetFoodRequest req, CancellationToken ct)
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

        var userIdClaim = User.FindFirstValue(AppClaims.UserId);
        Guid? currentUserId = Guid.TryParse(userIdClaim, out var parsed) ? parsed : null;

        // Enforce Private visibility: hide from other nutritionists.
        // Non-nutritionists (e.g. clients consuming a plan) are allowed regardless of visibility,
        // so that foods referenced from a nutrition plan remain readable downstream.
        if (food.Visibility == FoodVisibility.Private
            && User.IsInRole(AppRoles.Nutritionist)
            && food.NutritionistId != currentUserId)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var language = HttpContext.Request.Headers.AcceptLanguage.FirstOrDefault()
            ?.Split(',').FirstOrDefault()?.Trim().Split('-').FirstOrDefault();

        await Send.OkAsync(FoodSummary.FromDocument(food, language, currentUserId), ct);
    }
}
