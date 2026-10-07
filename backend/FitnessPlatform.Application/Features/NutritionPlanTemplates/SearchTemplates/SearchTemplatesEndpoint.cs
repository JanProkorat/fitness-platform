using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
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
    : Endpoint<SearchNutritionPlanTemplatesRequest, SearchNutritionPlanTemplatesResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/nutrition/plan-templates");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Search nutrition plan templates";
            s.Description = "Returns the caller's own templates at any visibility plus every Public template, filtered by goal/dietary style/week count/meals per day/in use. In-use counts only the caller's own Active plans.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SearchNutritionPlanTemplatesRequest req, CancellationToken ct)
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

        if (req.MealsPerDay.HasValue)
        {
            var mealsPerDayFilter = filterBuilder.Eq(t => t.MealsPerDay, req.MealsPerDay.Value);
            extraFilter = extraFilter is null ? mealsPerDayFilter : extraFilter & mealsPerDayFilter;
        }

        var usageByTemplate = await LoadCallerUsageAsync(callerId, ct);

        if (req.InUse.HasValue)
        {
            var usedTemplateIds = usageByTemplate.Keys.ToList();
            var inUseFilter = req.InUse.Value
                ? filterBuilder.In(t => t.ExternalId, usedTemplateIds)
                : filterBuilder.Nin(t => t.ExternalId, usedTemplateIds);
            extraFilter = extraFilter is null ? inUseFilter : extraFilter & inUseFilter;
        }

        var (templates, totalCount) = await this.SearchAsync(
            mongo.NutritionPlanTemplates, callerId, t => t.Name, req.Search, req.Page, req.PageSize, extraFilter, ct);

        await Send.OkAsync(new SearchNutritionPlanTemplatesResponse
        {
            Templates = templates
                .Select(t => NutritionPlanTemplateSummaryDto.FromDocument(
                    t, callerId, usageByTemplate.GetValueOrDefault(t.ExternalId)))
                .ToList(),
            TotalCount = totalCount,
            Page = req.Page,
            PageSize = req.PageSize
        }, ct);
    }

    /// <summary>
    /// Counts the caller's own Active plans per source template. Other nutritionists' plans are
    /// never counted, so a shared Public template never leaks its owner's client count.
    /// </summary>
    private async Task<Dictionary<Guid, int>> LoadCallerUsageAsync(Guid callerId, CancellationToken ct)
    {
        var planFilter = Builders<NutritionPlan>.Filter.Eq(p => p.NutritionistId, callerId)
                         & Builders<NutritionPlan>.Filter.Eq(p => p.Status, NutritionPlanStatus.Active)
                         & Builders<NutritionPlan>.Filter.Ne(p => p.SourceTemplateId, null);

        var sourceTemplateIds = await mongo.NutritionPlans
            .Find(planFilter)
            .Project(p => p.SourceTemplateId)
            .ToListAsync(ct);

        return sourceTemplateIds
            .Where(id => id.HasValue)
            .GroupBy(id => id!.Value)
            .ToDictionary(group => group.Key, group => group.Count());
    }
}
