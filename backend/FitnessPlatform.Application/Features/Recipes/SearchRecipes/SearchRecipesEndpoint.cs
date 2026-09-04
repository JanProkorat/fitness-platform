using System.Security.Claims;
using System.Text.RegularExpressions;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Recipes.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Bson;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Recipes.SearchRecipes;

/// <summary>
/// Searches recipes by name with pagination.
/// Results include the caller's own recipes (any visibility) plus other nutritionists' public recipes.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class SearchRecipesEndpoint(IMongoContext mongo)
    : Endpoint<SearchRecipesRequest, SearchRecipesResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/recipes");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Search recipes";
            s.Description = "Search recipes by name with pagination. "
                + "Returns the caller's own recipes (any visibility) plus public recipes owned by other nutritionists.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SearchRecipesRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        var filterBuilder = Builders<Recipe>.Filter;

        // Visibility filter: caller's own recipes (any visibility) OR other nutritionists' public
        // recipes. Mirrors LibrarySearchHelper.SearchAsync's Guid.Empty refusal (#992): the
        // ownership term is suppressed entirely for an empty caller id, so a document that
        // explicitly stores a zero-uuid owner can't be matched as "owned by the caller" below.
        var filter = nutritionistId == Guid.Empty
            ? filterBuilder.Eq(r => r.Visibility, RecipeVisibility.Public)
            : filterBuilder.Or(
                filterBuilder.Eq(r => r.NutritionistId, nutritionistId),
                filterBuilder.Eq(r => r.Visibility, RecipeVisibility.Public));

        if (!string.IsNullOrWhiteSpace(req.Search))
        {
            var escaped = Regex.Escape(req.Search);
            filter &= filterBuilder.Regex(r => r.Name, new BsonRegularExpression(escaped, "i"));
        }

        var totalCount = await mongo.Recipes.CountDocumentsAsync(filter, cancellationToken: ct);

        var findOptions = new FindOptions<Recipe>
        {
            Skip = (req.Page - 1) * req.PageSize,
            Limit = req.PageSize,
            Sort = Builders<Recipe>.Sort.Descending(r => r.DateCreated)
        };

        using var cursor = await mongo.Recipes.FindAsync(filter, findOptions, ct);
        var recipes = await cursor.ToListAsync(ct);

        await Send.OkAsync(new SearchRecipesResponse
        {
            Recipes = recipes.Select(r => RecipeSummaryDto.FromDocument(r, nutritionistId)).ToList(),
            TotalCount = totalCount,
            Page = req.Page,
            PageSize = req.PageSize
        }, ct);
    }
}
