using System.Security.Claims;
using System.Text.RegularExpressions;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.Recipes.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Bson;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Recipes.SearchRecipes;

/// <summary>
/// Searches recipes with filters, sortable columns and pagination.
/// Results include the caller's own recipes (any visibility) plus other nutritionists' public recipes.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class SearchRecipesEndpoint(IMongoContext mongo)
    : Endpoint<SearchRecipesRequest, SearchRecipesResponse>
{
    /// <summary>
    /// Field the computed sort key is written to by an <c>$addFields</c> stage and removed again by
    /// an <c>$unset</c> stage before the page is deserialized (<see cref="Recipe"/> does not ignore
    /// extra elements).
    /// </summary>
    private const string SortKeyField = "sortKey";

    /// <inheritdoc />
    public override void Configure()
    {
        Get("/recipes");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Search recipes";
            s.Description = "Search recipes by name or description with optional meal type (any), dietary "
                + "preference (all) and owner filters, sortable columns and pagination. "
                + "Returns the caller's own recipes (any visibility) plus public recipes owned by other nutritionists. "
                + "With no sort, newest-created first.";
            s.Responses[StatusCodes.Status400BadRequest] =
                "Invalid page, page size, filter value, or sort field/direction";
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
            var regex = new BsonRegularExpression(Regex.Escape(req.Search), "i");
            filter &= filterBuilder.Or(
                filterBuilder.Regex(r => r.Name, regex),
                filterBuilder.Regex(r => r.Description, regex));
        }

        if (req.MealTypes.Count > 0)
        {
            // Match ANY. Older documents may store lowercase spellings, so both are accepted.
            var spellings = req.MealTypes
                .SelectMany(mealType => new[] { mealType.ToString(), mealType.ToString().ToLowerInvariant() })
                .Distinct()
                .ToList();
            filter &= filterBuilder.AnyIn(r => r.MealTypes, spellings);
        }

        if (req.DietaryPreferences.Count > 0)
        {
            // Match ALL of the requested preferences.
            filter &= filterBuilder.All(
                r => r.DietaryPreferences,
                FoodEnumListMapping.ToStoredNames(req.DietaryPreferences.Distinct()));
        }

        var ownerFilter = BuildOwnerFilter(req.Owners, nutritionistId);

        if (ownerFilter is not null)
        {
            filter &= ownerFilter;
        }

        var totalCount = await mongo.Recipes.CountDocumentsAsync(filter, cancellationToken: ct);

        var language = HttpContext.Request.Headers.AcceptLanguage.FirstOrDefault()?.Split(',').FirstOrDefault()?.Split('-').FirstOrDefault()?.Trim().ToLowerInvariant();
        var sortLanguage = language is "cs" or "en" or "de" ? language : null;

        var recipes = await FetchSortedPageAsync(filter, req, nutritionistId, sortLanguage, ct);

        await Send.OkAsync(new SearchRecipesResponse
        {
            Recipes = recipes.Select(r => RecipeSummaryDto.FromDocument(r, nutritionistId)).ToList(),
            TotalCount = totalCount,
            Page = req.Page,
            PageSize = req.PageSize
        }, ct);
    }

    /// <summary>
    /// Builds the "caller matches ANY of the requested owner buckets" filter, or <see langword="null"/>
    /// when none were supplied. System recipes are owned by <see cref="SystemUsers.AdminId"/>.
    /// </summary>
    private static FilterDefinition<Recipe>? BuildOwnerFilter(List<FoodOwnerFilter> owners, Guid currentUserId)
    {
        if (owners.Count == 0)
        {
            return null;
        }

        var filterBuilder = Builders<Recipe>.Filter;
        var ownerFilters = new List<FilterDefinition<Recipe>>();

        if (owners.Contains(FoodOwnerFilter.Mine))
        {
            ownerFilters.Add(filterBuilder.Eq(r => r.NutritionistId, currentUserId));
        }

        if (owners.Contains(FoodOwnerFilter.System))
        {
            ownerFilters.Add(filterBuilder.Eq(r => r.NutritionistId, SystemUsers.AdminId));
        }

        if (owners.Contains(FoodOwnerFilter.OtherCoaches))
        {
            // The outer own-or-public filter already restricts candidates to Public-or-mine, so
            // "neither me nor the system user" is another coach's Public recipe here.
            ownerFilters.Add(
                filterBuilder.Ne(r => r.NutritionistId, currentUserId)
                & filterBuilder.Ne(r => r.NutritionistId, SystemUsers.AdminId));
        }

        return filterBuilder.Or(ownerFilters);
    }

    /// <summary>
    /// Runs the filter through an aggregation, adding a computed sort key only for columns that are
    /// not stored directly, then sorting and paging. A null <see cref="SearchRecipesRequest.SortBy"/>
    /// means newest-created first.
    /// </summary>
    private async Task<List<Recipe>> FetchSortedPageAsync(
        FilterDefinition<Recipe> filter,
        SearchRecipesRequest req,
        Guid currentUserId,
        string? sortLanguage,
        CancellationToken ct)
    {
        var sortBuilder = Builders<Recipe>.Sort;

        var effectiveSortBy = req.SortBy ?? RecipeSortField.DateCreated;
        var descending = req.SortBy is null
            ? true
            : (req.SortDir ?? FoodSortDirection.Ascending) == FoodSortDirection.Descending;

        SortDefinition<Recipe> sort;
        BsonValue? sortKeyExpression = null;
        Collation? collation = null;

        if (effectiveSortBy == RecipeSortField.DateCreated)
        {
            sort = descending
                ? sortBuilder.Combine(sortBuilder.Descending(r => r.DateCreated), sortBuilder.Descending(r => r.Id))
                : sortBuilder.Combine(sortBuilder.Ascending(r => r.DateCreated), sortBuilder.Ascending(r => r.Id));
        }
        else
        {
            sort = descending
                ? sortBuilder.Combine(sortBuilder.Descending(SortKeyField), sortBuilder.Descending(r => r.Id))
                : sortBuilder.Combine(sortBuilder.Ascending(SortKeyField), sortBuilder.Ascending(r => r.Id));

            sortKeyExpression = BuildSortKeyExpression(effectiveSortBy, currentUserId);

            // Only the Name sort compares translated strings; the collation applies the caller's
            // language rules (accents, case) to it.
            collation = effectiveSortBy == RecipeSortField.Name ? new Collation(sortLanguage ?? "cs") : null;
        }

        var aggregateOptions = new AggregateOptions();

        if (collation is not null)
        {
            aggregateOptions.Collation = collation;
        }

        var aggregate = mongo.Recipes.Aggregate(aggregateOptions).Match(filter);

        if (sortKeyExpression is not null)
        {
            PipelineStageDefinition<Recipe, Recipe> addFieldsStage =
                new BsonDocument("$addFields", new BsonDocument(SortKeyField, sortKeyExpression));
            aggregate = aggregate.AppendStage(addFieldsStage);
        }

        aggregate = aggregate
            .Sort(sort)
            .Skip((req.Page - 1) * req.PageSize)
            .Limit(req.PageSize);

        if (sortKeyExpression is not null)
        {
            PipelineStageDefinition<Recipe, Recipe> unsetStage = new BsonDocument("$unset", SortKeyField);
            aggregate = aggregate.AppendStage(unsetStage);
        }

        return await aggregate.ToListAsync(ct);
    }

    /// <summary>
    /// Builds the aggregation expression that backs the computed sort key for a column.
    /// </summary>
    private static BsonValue BuildSortKeyExpression(RecipeSortField sortBy, Guid currentUserId) =>
        sortBy switch
        {
            RecipeSortField.Name => "$name",

            // servings is absent on legacy documents and defaults to 1; clamped to at least 1 so a
            // stray zero cannot divide by zero. kcal may be stored as a string or Decimal128, so
            // $toDouble makes the sort numeric.
            RecipeSortField.CaloriesPerServing => new BsonDocument("$divide", new BsonArray
            {
                new BsonDocument("$toDouble", "$totalNutrients.kcal"),
                new BsonDocument("$max", new BsonArray
                {
                    new BsonDocument("$ifNull", new BsonArray { "$servings", 1 }),
                    1
                })
            }),

            RecipeSortField.Servings => new BsonDocument("$ifNull", new BsonArray { "$servings", 1 }),

            // Mine (0) before other coaches (1) before system (2).
            RecipeSortField.Library => new BsonDocument("$switch", new BsonDocument
            {
                ["branches"] = new BsonArray
                {
                    new BsonDocument
                    {
                        ["case"] = new BsonDocument(
                            "$eq", new BsonArray { "$nutritionistId", new BsonBinaryData(currentUserId, GuidRepresentation.Standard) }),
                        ["then"] = 0
                    },
                    new BsonDocument
                    {
                        ["case"] = new BsonDocument(
                            "$eq", new BsonArray { "$nutritionistId", new BsonBinaryData(SystemUsers.AdminId, GuidRepresentation.Standard) }),
                        ["then"] = 2
                    }
                },
                ["default"] = 1
            }),

            _ => throw new ArgumentOutOfRangeException(nameof(sortBy), sortBy, "Unhandled RecipeSortField.")
        };
}
