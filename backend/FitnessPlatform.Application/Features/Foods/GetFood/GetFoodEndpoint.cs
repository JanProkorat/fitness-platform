using FastEndpoints;
using FitnessPlatform.Application.Domain.Documents;
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
            s.Description = "Returns a single food item by its public identifier.";
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

        var language = HttpContext.Request.Headers.AcceptLanguage.FirstOrDefault()
            ?.Split(',').FirstOrDefault()?.Trim().Split('-').FirstOrDefault();

        await Send.OkAsync(FoodSummary.FromDocument(food, language), ct);
    }
}
