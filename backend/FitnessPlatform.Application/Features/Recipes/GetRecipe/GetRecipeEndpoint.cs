using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Recipes.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Recipes.GetRecipe;

/// <summary>
/// Retrieves a single recipe by its public identifier.
/// Nutritionists see their own recipes at any visibility and other nutritionists' public recipes.
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
            s.Description = "Returns full detail of a recipe. "
                + "Nutritionists can read their own recipes (any visibility) and public recipes owned by others; "
                + "other nutritionists' private recipes return 404.";
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

        var filterBuilder = Builders<Recipe>.Filter;

        // Mirrors LibrarySearchHelper.SearchAsync's Guid.Empty refusal (#992): the ownership term
        // is suppressed entirely for an empty caller id, so a document that explicitly stores a
        // zero-uuid owner can't be matched as "owned by the caller" below.
        var visibilityFilter = nutritionistId == Guid.Empty
            ? filterBuilder.Eq(r => r.Visibility, RecipeVisibility.Public)
            : filterBuilder.Or(
                filterBuilder.Eq(r => r.NutritionistId, nutritionistId),
                filterBuilder.Eq(r => r.Visibility, RecipeVisibility.Public));

        var filter = filterBuilder.Eq(r => r.ExternalId, req.RecipeId) & visibilityFilter;

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

        await Send.OkAsync(GetRecipeResponse.FromDocument(recipe, foodLookup, language, nutritionistId), ct);
    }
}
