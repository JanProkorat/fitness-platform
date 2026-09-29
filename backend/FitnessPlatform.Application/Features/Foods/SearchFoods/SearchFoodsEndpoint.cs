using System.Security.Claims;
using System.Text.RegularExpressions;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.Foods.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Bson;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Foods.SearchFoods;

/// <summary>
/// Searches foods by name in the local database.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class SearchFoodsEndpoint(
    IMongoContext mongo) : Endpoint<SearchFoodsRequest, SearchFoodsResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/foods/search");
        Summary(s =>
        {
            s.Summary = "Search foods";
            s.Description = "Fulltext search across food database with optional multi-value category filter, tags filter, and pagination.";
            s.Response<SearchFoodsResponse>(StatusCodes.Status200OK, "Matching foods");
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid page, page size, tags filter, or category filter";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SearchFoodsRequest req, CancellationToken ct)
    {
        var language = HttpContext.Request.Headers.AcceptLanguage.FirstOrDefault()?.Split(',').FirstOrDefault()?.Split('-').FirstOrDefault();

        var userIdClaim = User.FindFirstValue(AppClaims.UserId);
        if (!Guid.TryParse(userIdClaim, out var currentUserId))
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var filterBuilder = Builders<Food>.Filter;
        var filter = FoodVisibilityFilter.BuildOwnOrPublic(currentUserId);

        if (req.Categories.Count > 0)
        {
            // "Match any" semantics — same shape as the tags filter below.
            filter &= filterBuilder.In(f => f.Category, req.Categories);
        }

        if (req.Tags.Count > 0)
        {
            // Tags are stored lowercase + trimmed (CreateFoodEndpoint/UpdateFoodEndpoint), so the
            // filter values must be normalized the same way or a differently-cased pill (e.g.
            // "MEAL-PREP") would silently match nothing.
            var normalizedTags = req.Tags.Select(t => t.Trim().ToLowerInvariant()).ToList();

            // AnyIn matches a document whose Tags array contains at least one of the supplied
            // values — the "match any" semantics the tags filter pill needs.
            filter &= filterBuilder.AnyIn(f => f.Tags, normalizedTags);
        }

        if (!string.IsNullOrWhiteSpace(req.Query))
        {
            var escaped = Regex.Escape(req.Query);
            var regex = new BsonRegularExpression(escaped, "i");

            // Match against canonical name and the localized name for the user's language
            var nameFilters = new List<FilterDefinition<Food>>
            {
                filterBuilder.Regex(f => f.Name, regex)
            };

            var localizedField = language?.ToLowerInvariant() switch
            {
                "en" => "localizedNames.en",
                "cs" => "localizedNames.cs",
                "de" => "localizedNames.de",
                _ => null
            };

            if (localizedField is not null)
            {
                nameFilters.Add(filterBuilder.Regex(localizedField, regex));
            }

            filter &= filterBuilder.Or(nameFilters);
        }

        var totalCount = await mongo.Foods.CountDocumentsAsync(filter, cancellationToken: ct);

        var findOptions = new FindOptions<Food>
        {
            Skip = (req.Page - 1) * req.PageSize,
            Limit = req.PageSize,
            // Deterministic paging — name asc, then _id asc as a tiebreaker for equal names.
            Sort = Builders<Food>.Sort.Ascending(f => f.Name).Ascending(f => f.Id)
        };

        using var cursor = await mongo.Foods.FindAsync(filter, findOptions, ct);
        var localFoods = await cursor.ToListAsync(ct);

        await Send.OkAsync(new SearchFoodsResponse
        {
            Foods = localFoods.Select(f => FoodSummary.FromDocument(f, language, currentUserId)).ToList(),
            TotalCount = totalCount,
            Page = req.Page,
            PageSize = req.PageSize
        }, ct);
    }
}
