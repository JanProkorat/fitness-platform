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
        var userIdClaim = User.FindFirstValue(AppClaims.UserId);
        Guid? currentUserId = Guid.TryParse(userIdClaim, out var parsed) ? parsed : null;

        var filterBuilder = Builders<Food>.Filter;

        var filter = filterBuilder.Eq(f => f.ExternalId, req.FoodId)
            & filterBuilder.Eq(f => f.IsDeleted, false);

        // Private foods are hidden from other nutritionists. Gated in the query rather than after
        // the read, matching the three own-or-public sites #992 guarded. Non-nutritionists (e.g. a
        // client consuming a plan) are exempt, so foods a nutrition plan references stay readable.
        // FoodVisibility is Public|Private only, so Eq(Public) is the exact complement of the
        // previous "not Private" test.
        if (User.IsInRole(AppRoles.Nutritionist))
        {
            // The ownership term is suppressed entirely for an absent or zero-uuid caller id, so a
            // food storing no owner can no longer match as "owned by the caller" — which is what
            // the in-memory null != null comparison silently allowed (#1010).
            filter &= currentUserId is null || currentUserId == Guid.Empty
                ? filterBuilder.Eq(f => f.Visibility, FoodVisibility.Public)
                : filterBuilder.Or(
                    filterBuilder.Eq(f => f.NutritionistId, currentUserId),
                    filterBuilder.Eq(f => f.Visibility, FoodVisibility.Public));
        }

        using var cursor = await mongo.Foods.FindAsync(filter, cancellationToken: ct);
        var food = await cursor.FirstOrDefaultAsync(ct);

        if (food is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var language = HttpContext.Request.Headers.AcceptLanguage.FirstOrDefault()
            ?.Split(',').FirstOrDefault()?.Trim().Split('-').FirstOrDefault();

        await Send.OkAsync(FoodSummary.FromDocument(food, language, currentUserId), ct);
    }
}
