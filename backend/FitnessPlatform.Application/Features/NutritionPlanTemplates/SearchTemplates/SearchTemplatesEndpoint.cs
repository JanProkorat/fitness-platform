using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.NutritionPlanTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.SearchTemplates;

/// <summary>
/// Searches nutrition plan templates: the caller's own entries at any visibility, plus every
/// nutritionist's <c>Public</c> entries. No dedicated paging validator — <see cref="LibrarySearchHelper"/>
/// already validates <c>page</c>/<c>pageSize</c>/search-term length internally.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class SearchTemplatesEndpoint(IMongoContext mongo)
    : Endpoint<SearchTemplatesRequest, SearchTemplatesResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/nutrition/plan-templates");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Search nutrition plan templates";
            s.Description = "Returns the caller's own templates at any visibility plus every Public template, filtered by goal/dietary style/week count.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SearchTemplatesRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var callerId = Guid.Parse(userId);

        var filterBuilder = Builders<NutritionPlanTemplate>.Filter;
        FilterDefinition<NutritionPlanTemplate>? extraFilter = null;

        if (req.Goal.HasValue)
        {
            extraFilter = filterBuilder.Eq(t => t.Goal, req.Goal.Value);
        }

        if (req.DietaryStyle.HasValue)
        {
            var dietaryStyleFilter = filterBuilder.Eq(t => t.DietaryStyle, req.DietaryStyle.Value);
            extraFilter = extraFilter is null ? dietaryStyleFilter : extraFilter & dietaryStyleFilter;
        }

        if (req.WeekCount.HasValue)
        {
            var weekCountFilter = filterBuilder.Eq(t => t.WeekCount, req.WeekCount.Value);
            extraFilter = extraFilter is null ? weekCountFilter : extraFilter & weekCountFilter;
        }

        var (templates, totalCount) = await this.SearchAsync(
            mongo.NutritionPlanTemplates, callerId, t => t.Name, req.Search, req.Page, req.PageSize, extraFilter, ct);

        await Send.OkAsync(new SearchTemplatesResponse
        {
            Templates = templates.Select(t => NutritionPlanTemplateSummaryDto.FromDocument(t, callerId)).ToList(),
            TotalCount = totalCount,
            Page = req.Page,
            PageSize = req.PageSize
        }, ct);
    }
}
