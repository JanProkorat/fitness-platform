using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.SessionTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.AspNetCore.Http;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.SessionTemplates.SearchSessionTemplates;

/// <summary>
/// Searches session templates by name, difficulty, and estimated duration with pagination.
/// Results are the caller's own templates (any visibility) plus everyone's public templates,
/// sorted by <c>DateCreated</c> descending (the library's default sort).
/// </summary>
/// <param name="mongo">MongoDB context.</param>
internal sealed class SearchSessionTemplatesEndpoint(IMongoContext mongo)
    : Endpoint<SearchSessionTemplatesRequest, SearchSessionTemplatesResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/training/session-templates");
        Roles(AppRoles.Trainer);
        DontCatchExceptions();
        Description(b => b.WithName(nameof(SearchSessionTemplatesEndpoint)));
        Summary(s =>
        {
            s.Summary = "Search session templates";
            s.Description = "Search session templates by name/difficulty/estimated duration with pagination, sorted by DateCreated descending. Returns the caller's own templates (any visibility) plus public templates owned by other trainers.";
            s.Responses[StatusCodes.Status200OK] = "Paged session template results";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid paging or search parameters";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SearchSessionTemplatesRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var trainerId = Guid.Parse(userId);

        var extraFilter = BuildExtraFilter(req);

        var (items, totalCount) = await this.SearchAsync(
            mongo.SessionTemplates,
            trainerId,
            t => t.Name,
            req.Search,
            req.Page,
            req.PageSize,
            extraFilter,
            ct);

        await Send.OkAsync(new SearchSessionTemplatesResponse
        {
            Templates = items.Select(t => SessionTemplateSummaryDto.FromDocument(t, trainerId)).ToList(),
            TotalCount = totalCount,
            Page = req.Page,
            PageSize = req.PageSize
        }, ct);
    }

    private static FilterDefinition<SessionTemplate>? BuildExtraFilter(SearchSessionTemplatesRequest req)
    {
        var builder = Builders<SessionTemplate>.Filter;
        FilterDefinition<SessionTemplate>? filter = null;

        if (req.Difficulty.HasValue)
        {
            filter = builder.Eq(t => t.Difficulty, req.Difficulty.Value);
        }

        if (req.MaxEstimatedDurationMinutes.HasValue)
        {
            var durationFilter = builder.Lte(t => t.EstimatedDurationMinutes, req.MaxEstimatedDurationMinutes.Value);
            filter = filter is null ? durationFilter : filter & durationFilter;
        }

        return filter;
    }
}
