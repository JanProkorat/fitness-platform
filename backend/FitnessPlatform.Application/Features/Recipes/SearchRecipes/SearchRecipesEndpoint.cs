using System.Security.Claims;
using System.Text.RegularExpressions;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.Recipes.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Bson;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Recipes.SearchRecipes;

/// <summary>
/// Searches recipes by name for the current nutritionist with pagination.
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
            s.Description = "Search the current nutritionist's recipes by name with pagination.";
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
        var filter = filterBuilder.Eq(r => r.NutritionistId, nutritionistId);

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
            Recipes = recipes.Select(RecipeSummaryDto.FromDocument).ToList(),
            TotalCount = totalCount,
            Page = req.Page,
            PageSize = req.PageSize
        }, ct);
    }
}
