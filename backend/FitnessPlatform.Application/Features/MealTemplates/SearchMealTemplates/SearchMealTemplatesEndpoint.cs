using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.MealTemplates.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.AspNetCore.Http;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.MealTemplates.SearchMealTemplates;

/// <summary>
/// Searches meal templates by name with pagination. Results are the caller's own templates
/// (any visibility) plus everyone's public templates, sorted by calories descending.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
internal sealed class SearchMealTemplatesEndpoint(IMongoContext mongo)
    : Endpoint<SearchMealTemplatesRequest, SearchMealTemplatesResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/nutrition/meal-templates");
        Roles(AppRoles.Nutritionist);
        DontCatchExceptions();
        Description(b => b.WithName(nameof(SearchMealTemplatesEndpoint)));
        Summary(s =>
        {
            s.Summary = "Search meal templates";
            s.Description = "Search meal templates by name with pagination, sorted by calories descending (the library's default and only sort). Returns the caller's own templates (any visibility) plus public templates owned by other nutritionists.";
            s.Responses[StatusCodes.Status200OK] = "Paged meal template results";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid paging or search parameters";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or invalid credentials";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SearchMealTemplatesRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        var (items, totalCount) = await this.SearchAsync(
            mongo.MealTemplates,
            nutritionistId,
            t => t.Name,
            req.Search,
            req.Page,
            req.PageSize,
            extraFilter: null,
            ct,
            primarySort: Builders<MealTemplate>.Sort.Descending(t => t.TotalNutrients.Kcal));

        await Send.OkAsync(new SearchMealTemplatesResponse
        {
            Templates = items.Select(t => MealTemplateSummaryDto.FromDocument(t, nutritionistId)).ToList(),
            TotalCount = totalCount,
            Page = req.Page,
            PageSize = req.PageSize
        }, ct);
    }
}
