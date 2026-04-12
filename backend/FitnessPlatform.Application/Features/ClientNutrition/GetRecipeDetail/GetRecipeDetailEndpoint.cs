using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.Recipes.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.GetRecipeDetail;

/// <summary>
/// Client-facing endpoint that returns full recipe detail (ingredients, steps, macros).
/// Clients can view any recipe — access is not restricted to owned recipes.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class GetRecipeDetailEndpoint(IMongoContext mongo)
    : Endpoint<GetRecipeDetailRequest, GetRecipeResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/recipes/{RecipeId}");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Get recipe detail (client)";
            s.Description = "Returns full detail of a recipe including ingredients, steps, and macros.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetRecipeDetailRequest req, CancellationToken ct)
    {
        var filter = Builders<Recipe>.Filter.Eq(r => r.ExternalId, req.RecipeId);

        using var cursor = await mongo.Recipes.FindAsync(filter, cancellationToken: ct);
        var recipe = await cursor.FirstOrDefaultAsync(ct);

        if (recipe is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Resolve localized food names
        var foodIds = recipe.Foods.Select(f => f.FoodExternalId).Distinct().ToList();
        var foodFilter = Builders<Food>.Filter.In(f => f.ExternalId, foodIds);
        using var foodCursor = await mongo.Foods.FindAsync(foodFilter, cancellationToken: ct);
        var foods = await foodCursor.ToListAsync(ct);
        var foodLookup = foods.ToDictionary(f => f.ExternalId) as IReadOnlyDictionary<Guid, Food>;

        var language = HttpContext.Request.Headers.AcceptLanguage.FirstOrDefault()
            ?.Split(',').FirstOrDefault()?.Trim().Split('-').FirstOrDefault();

        await Send.OkAsync(GetRecipeResponse.FromDocument(recipe, foodLookup, language), ct);
    }
}
