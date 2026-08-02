using System.Linq.Expressions;
using System.Text.RegularExpressions;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using MongoDB.Bson;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Shared name-search + pagination for the four sharing-library features (meal, session,
/// nutrition-plan, training-plan templates). Pins the conventions the two existing repo
/// precedents actively disagree on, so no consuming endpoint invents its own variant:
/// <list type="bullet">
/// <item>
/// Own-or-public visibility filter, matching <c>SearchRecipesEndpoint.cs:50-53</c>.
/// </item>
/// <item>
/// Sets the <c>X-Total-Count</c> response header, matching
/// <c>ListSectionTemplatesEndpoint.cs:47</c> — not just returning the total in the body
/// as <c>SearchRecipesEndpoint.cs</c> does.
/// </item>
/// <item>
/// Sorts <c>DateCreated</c> descending by default, with <c>ExternalId</c> ascending
/// <b>always</b> appended as a tiebreaker regardless of what a caller supplies — a deterministic
/// ordering neither <c>SearchRecipesEndpoint.cs:67</c> (DateCreated desc only) nor
/// <c>ListSectionTemplatesEndpoint.cs:54</c> (CreatedAt asc only) provides on its own — a
/// non-unique sort key produces nondeterministic paging (repeated or skipped documents across
/// pages when several entries share one sort-key value). A library whose design calls for a
/// different primary sort (e.g. calories) passes <c>primarySort</c> to override the default —
/// the <c>ExternalId</c> tiebreaker can never be dropped by that override.
/// </item>
/// </list>
/// </summary>
public static class LibrarySearchHelper
{
    /// <summary>Maximum allowed <c>pageSize</c> across every library search endpoint.</summary>
    public const int MaxPageSize = 100;

    /// <summary>
    /// Maximum allowed <c>page</c> across every library search endpoint. <c>page</c> has a
    /// lower bound of 1 but, without an upper bound, a large caller-supplied value overflows
    /// the <c>(page - 1) * pageSize</c> multiplication to a negative <c>Skip</c>, which Mongo
    /// rejects — a trivially reachable 500.
    /// </summary>
    public const int MaxPage = 100_000;

    /// <summary>
    /// Maximum allowed length of a caller-supplied search term. An uncapped
    /// <see cref="Regex.Escape(string)"/>'d term run as a case-insensitive unanchored regex
    /// over an unindexed name field, across four search endpoints, is a cheap CPU
    /// denial-of-service otherwise.
    /// </summary>
    public const int MaxSearchTermLength = 100;

    /// <summary>
    /// Searches a sharing-library collection by name with pagination. Results are the
    /// caller's own entries (any visibility) plus everyone's <see cref="LibraryVisibility.Public"/>
    /// entries, further narrowed by <paramref name="extraFilter"/> and, when
    /// <paramref name="search"/> is supplied, by a <see cref="Regex.Escape(string)"/>'d
    /// case-insensitive match against <paramref name="nameSelector"/>. Sets the
    /// <c>X-Total-Count</c> response header and returns the same count. Rejects
    /// <paramref name="page"/> outside <c>1..<see cref="MaxPage"/></c>,
    /// <paramref name="pageSize"/> outside <c>1..100</c>, and an over-length
    /// <paramref name="search"/> term with a 400 via
    /// <see cref="EndpointErrorExtensions.ThrowErrorWithCode"/>.
    /// </summary>
    /// <typeparam name="TDoc">The sharing-library document type.</typeparam>
    /// <param name="endpoint">The calling endpoint — used to set the response header and to throw the 400.</param>
    /// <param name="collection">The Mongo collection to search.</param>
    /// <param name="callerId">The authenticated caller's user id.</param>
    /// <param name="nameSelector">Selects the document's name field for the search regex — not on <see cref="ILibraryDocument"/>, so every caller supplies its own.</param>
    /// <param name="search">Optional caller-supplied search text.</param>
    /// <param name="page">1-based page number.</param>
    /// <param name="pageSize">Page size, capped at <see cref="MaxPageSize"/>.</param>
    /// <param name="extraFilter">Additional library-specific filter (e.g. calories, difficulty, goal) AND'd into the own-or-public filter. Pass <c>null</c> when the library has none.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <param name="primarySort">
    /// Overrides the default <c>DateCreated</c> descending primary sort (e.g. a library that
    /// sorts on calories). Pass <c>null</c> to use the default. Regardless of what is passed
    /// here, an <c>ExternalId</c> ascending tiebreaker is always appended internally — a custom
    /// sort can never drop the determinism guarantee.
    /// <para>
    /// <b>Never pass a sort on <c>ExternalId</c> here.</b> A Mongo sort is a single BSON document,
    /// so it cannot carry <c>externalId</c> twice with two directions — <c>Sort.Combine</c>
    /// collapses the pair by merging each sort into one document with later entries overwriting
    /// earlier ones for the same key, and the tiebreaker is always the later (last-applied) entry.
    /// Observed and pinned against a real MongoDB container in
    /// <c>LibrarySearchHelperTests.SearchAsync_PrimarySortOnExternalId_TiebreakerWinsAndOrdersAscending</c>:
    /// a <paramref name="primarySort"/> of <c>Descending(d =&gt; d.ExternalId)</c> is silently
    /// executed ascending — the caller-requested direction is discarded, not honoured and not
    /// rejected. The determinism guarantee is unaffected either way (ExternalId is still the sole
    /// surviving sort key), but a child library must not rely on a custom direction for it.
    /// </para>
    /// </param>
    public static async Task<(IReadOnlyList<TDoc> Items, long TotalCount)> SearchAsync<TDoc>(
        this IEndpoint endpoint,
        IMongoCollection<TDoc> collection,
        Guid callerId,
        Expression<Func<TDoc, string>> nameSelector,
        string? search,
        int page,
        int pageSize,
        FilterDefinition<TDoc>? extraFilter,
        CancellationToken ct,
        SortDefinition<TDoc>? primarySort = null)
        where TDoc : class, ILibraryDocument
    {
        ValidatePagingOrThrow(endpoint, page, pageSize, search);

        var filterBuilder = Builders<TDoc>.Filter;

        FilterDefinition<TDoc> visibilityFilter = filterBuilder.Or(
            filterBuilder.Eq(d => d.OwnerId, callerId),
            filterBuilder.Eq(d => d.Visibility, LibraryVisibility.Public));

        var filter = extraFilter is null ? visibilityFilter : visibilityFilter & extraFilter;

        if (!string.IsNullOrWhiteSpace(search))
        {
            var escaped = Regex.Escape(search);
            var nameField = new ExpressionFieldDefinition<TDoc, string>(nameSelector);
            filter &= filterBuilder.Regex(nameField, new BsonRegularExpression(escaped, "i"));
        }

        var totalCount = await collection.CountDocumentsAsync(filter, cancellationToken: ct);
        endpoint.HttpContext.Response.Headers["X-Total-Count"] = totalCount.ToString();

        var findOptions = new FindOptions<TDoc>
        {
            Skip = (page - 1) * pageSize,
            Limit = pageSize,
            // The ExternalId tiebreaker is appended unconditionally, regardless of whether
            // primarySort was supplied — a custom primary sort can never lose the determinism
            // guarantee by omission.
            Sort = Builders<TDoc>.Sort.Combine(
                primarySort ?? Builders<TDoc>.Sort.Descending(d => d.DateCreated),
                Builders<TDoc>.Sort.Ascending(d => d.ExternalId))
        };

        using var cursor = await collection.FindAsync(filter, findOptions, ct);
        var items = await cursor.ToListAsync(ct);

        return (items, totalCount);
    }

    private static void ValidatePagingOrThrow(IEndpoint endpoint, int page, int pageSize, string? search)
    {
        if (page is < 1 or > MaxPage)
        {
            endpoint.ThrowErrorWithCode(ErrorCodes.OutOfRange, $"Page must be between 1 and {MaxPage}.");
        }

        if (pageSize is < 1 or > MaxPageSize)
        {
            endpoint.ThrowErrorWithCode(ErrorCodes.OutOfRange, $"PageSize must be between 1 and {MaxPageSize}.");
        }

        if (search is not null && search.Length > MaxSearchTermLength)
        {
            endpoint.ThrowErrorWithCode(ErrorCodes.OutOfRange, $"Search term must be at most {MaxSearchTermLength} characters.");
        }
    }
}
