using System.Security.Claims;
using System.Text.RegularExpressions;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
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
            s.Description = "Fulltext search across food database with optional source filter and pagination.";
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

        // Mirrors LibrarySearchHelper.SearchAsync's Guid.Empty refusal (#992): the ownership term
        // is suppressed entirely for an empty caller id rather than compared against it, since a
        // document whose nutritionistId field is absent deserializes to Guid.Empty and would
        // otherwise match via the Eq disjunct below.
        var visibilityFilter = currentUserId == Guid.Empty
            ? filterBuilder.Eq(f => f.Visibility, FoodVisibility.Public)
            : filterBuilder.Or(
                filterBuilder.Eq(f => f.Visibility, FoodVisibility.Public),
                filterBuilder.Eq(f => f.NutritionistId, currentUserId));

        var filter = filterBuilder.Eq(f => f.IsDeleted, false) & visibilityFilter;

        if (req.Category.HasValue)
        {
            filter &= filterBuilder.Eq(f => f.Category, req.Category.Value);
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
            Limit = req.PageSize
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
