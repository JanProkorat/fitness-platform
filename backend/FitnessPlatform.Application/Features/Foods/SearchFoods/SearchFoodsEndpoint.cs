using System.Text.RegularExpressions;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Foods.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Bson;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Foods.SearchFoods;

/// <summary>
/// Searches foods by name with optional source filter. Supplements local results
/// with Open Food Facts data if fewer than pageSize results are found.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="externalService">External food data provider.</param>
public class SearchFoodsEndpoint(
    IMongoContext mongo,
    IFoodExternalService externalService) : Endpoint<SearchFoodsRequest, SearchFoodsResponse>
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
        var filterBuilder = Builders<Food>.Filter;
        var filter = filterBuilder.Eq(f => f.IsDeleted, false);

        if (!string.IsNullOrWhiteSpace(req.Query))
        {
            var escaped = Regex.Escape(req.Query);
            filter &= filterBuilder.Regex(f => f.Name, new BsonRegularExpression(escaped, "i"));
        }

        if (!string.IsNullOrWhiteSpace(req.Source))
            filter &= filterBuilder.Eq(f => f.Source, req.Source.ToLowerInvariant());

        var totalCount = await mongo.Foods.CountDocumentsAsync(filter, cancellationToken: ct);

        var findOptions = new FindOptions<Food>
        {
            Skip = (req.Page - 1) * req.PageSize,
            Limit = req.PageSize
        };

        using var cursor = await mongo.Foods.FindAsync(filter, findOptions, ct);
        var localFoods = await cursor.ToListAsync(ct);

        // Supplement with OFF results on first page if we have a query and not enough local results
        if (req.Page == 1
            && !string.IsNullOrWhiteSpace(req.Query)
            && localFoods.Count < req.PageSize
            && req.Source is null or "openfoodfacts")
        {
            try
            {
                var remaining = req.PageSize - localFoods.Count;
                var externalFoods = await externalService.SearchByNameAsync(req.Query, remaining, ct);

                if (externalFoods is { Count: > 0 })
                {
                    // Deduplicate by barcode
                    var existingBarcodes = localFoods
                        .Where(f => f.Barcode is not null)
                        .Select(f => f.Barcode)
                        .ToHashSet();

                    var uniqueExternal = externalFoods
                        .Where(f => f.Barcode is null || !existingBarcodes.Contains(f.Barcode))
                        .Take(remaining);

                    localFoods.AddRange(uniqueExternal);
                }
            }
            catch (Exception)
            {
                // External service unavailable — return local results only
            }
        }

        await Send.OkAsync(new SearchFoodsResponse
        {
            Foods = localFoods.Select(FoodSummary.FromDocument).ToList(),
            TotalCount = totalCount,
            Page = req.Page,
            PageSize = req.PageSize
        }, ct);
    }
}
