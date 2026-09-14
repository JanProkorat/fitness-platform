using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.TrainingPlanTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.TrainingPlanTemplates.SearchTemplates;

/// <summary>
/// Searches training plan templates: the caller's own entries at any visibility, plus every
/// trainer's <c>Public</c> entries. No dedicated paging validator — <see cref="LibrarySearchHelper"/>
/// already validates <c>page</c>/<c>pageSize</c>/search-term length internally.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class SearchTrainingPlanTemplatesEndpoint(IMongoContext mongo)
    : Endpoint<SearchTrainingPlanTemplatesRequest, SearchTrainingPlanTemplatesResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/training/plan-templates");
        Roles(AppRoles.Trainer);
        Summary(s =>
        {
            s.Summary = "Search training plan templates";
            s.Description = "Returns the caller's own templates at any visibility plus every Public template, filtered by goal/difficulty/week count.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SearchTrainingPlanTemplatesRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var callerId = Guid.Parse(userId);

        var filterBuilder = Builders<TrainingPlanTemplate>.Filter;
        FilterDefinition<TrainingPlanTemplate>? extraFilter = null;

        if (req.Goal.HasValue)
        {
            extraFilter = filterBuilder.Eq(t => t.Goal, req.Goal.Value);
        }

        if (req.Difficulty.HasValue)
        {
            var difficultyFilter = filterBuilder.Eq(t => t.Difficulty, req.Difficulty.Value);
            extraFilter = extraFilter is null ? difficultyFilter : extraFilter & difficultyFilter;
        }

        if (req.WeekCount.HasValue)
        {
            var weekCountFilter = filterBuilder.Eq(t => t.WeekCount, req.WeekCount.Value);
            extraFilter = extraFilter is null ? weekCountFilter : extraFilter & weekCountFilter;
        }

        var (templates, totalCount) = await this.SearchAsync(
            mongo.TrainingPlanTemplates, callerId, t => t.Name, req.Search, req.Page, req.PageSize, extraFilter, ct);

        await Send.OkAsync(new SearchTrainingPlanTemplatesResponse
        {
            Templates = templates.Select(t => TrainingPlanTemplateSummaryDto.FromDocument(t, callerId)).ToList(),
            TotalCount = totalCount,
            Page = req.Page,
            PageSize = req.PageSize
        }, ct);
    }
}
