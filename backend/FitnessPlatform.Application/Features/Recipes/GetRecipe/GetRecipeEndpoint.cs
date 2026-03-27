using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.Recipes.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Recipes.GetRecipe;

/// <summary>
/// Retrieves a single recipe by its public identifier.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class GetRecipeEndpoint(IMongoContext mongo)
    : Endpoint<GetRecipeRequest, GetRecipeResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/recipes/{RecipeId}");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Get recipe";
            s.Description = "Returns full detail of a recipe owned by the current nutritionist.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetRecipeRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        var filter = Builders<Recipe>.Filter.Eq(r => r.ExternalId, req.RecipeId)
            & Builders<Recipe>.Filter.Eq(r => r.NutritionistId, nutritionistId);

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

        var language = HttpContext.Request.Headers.AcceptLanguage.FirstOrDefault()?.Split(',').FirstOrDefault()?.Trim().Split('-').FirstOrDefault();

        await Send.OkAsync(GetRecipeResponse.FromDocument(recipe, foodLookup, language), ct);
    }
}
