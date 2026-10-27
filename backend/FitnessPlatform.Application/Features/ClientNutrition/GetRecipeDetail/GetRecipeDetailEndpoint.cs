using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.ClientNutrition.Shared;
using FitnessPlatform.Application.Features.Recipes.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.GetRecipeDetail;

/// <summary>
/// Client-facing endpoint that returns full recipe detail (ingredients, steps, macros).
/// A recipe is returned only when it is used in a published week of one of the caller's own
/// Active or Completed nutrition plans; otherwise 404.
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
            s.Description = "Returns full detail of a recipe including ingredients, steps, and macros. " +
                            "Only recipes used in a published week of the caller's own Active or Completed plans are visible.";
            s.Responses[StatusCodes.Status200OK] = "Recipe detail";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status404NotFound] = "Recipe missing, or not used in any of the caller's visible plans";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GetRecipeDetailRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var visiblePlans = await ClientVisibleRecipes.LoadVisiblePlansAsync(mongo, Guid.Parse(userId), ct);

        if (!ClientVisibleRecipes.IsVisible(visiblePlans, req.RecipeId))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

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
