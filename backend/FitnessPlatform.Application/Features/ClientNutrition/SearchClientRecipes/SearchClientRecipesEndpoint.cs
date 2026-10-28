using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.ClientNutrition.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.SearchClientRecipes;

/// <summary>
/// Lists the recipes used in the caller's own nutrition plans, one item per (plan, recipe).
/// </summary>
/// <param name="mongo">MongoDB context.</param>
/// <param name="db">Relational database context.</param>
/// <param name="timeProvider">Clock.</param>
internal sealed class SearchClientRecipesEndpoint(IMongoContext mongo, IApplicationDbContext db, TimeProvider timeProvider)
    : Endpoint<SearchClientRecipesRequest, SearchClientRecipesResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Get("/client/nutrition/recipes");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "List recipes used in my nutrition plans";
            s.Description = "Returns (plan, recipe) items for recipes in published weeks of the caller's own Active or " +
                            "Completed plans, newest plan first. Filter by PlanId and MealType. " +
                            "The total item count is in the X-Total-Count response header.";
            s.Responses[StatusCodes.Status200OK] = "One page of recipe items";
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid paging or filter value";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status404NotFound] = "PlanId is not one of the caller's visible plans";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(SearchClientRecipesRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var clientId = Guid.Parse(userId);
        var visiblePlans = await ClientVisibleRecipes.LoadVisiblePlansAsync(mongo, clientId, ct);

        if (req.PlanId.HasValue && visiblePlans.All(p => p.ExternalId != req.PlanId.Value))
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var todayUtc = await db.ResolveClientLocalDateUtcAsync(clientId, timeProvider.GetUtcNow().UtcDateTime, ct);
        var currentPlan = PlanWindowResolver.ResolveCurrentPlanStrict(
            visiblePlans.Where(p => p.Status == NutritionPlanStatus.Active),
            p => p.StartDate,
            p => p.Weeks.Count,
            DateOnly.FromDateTime(todayUtc));

        var pairs = visiblePlans
            .Where(p => !req.PlanId.HasValue || p.ExternalId == req.PlanId.Value)
            .OrderByDescending(p => p.StartDate ?? DateTime.MinValue)
            .ThenByDescending(p => p.DateCreated)
            .SelectMany(plan => ClientVisibleRecipes.GetUsages(plan)
                .Where(u => !req.MealType.HasValue || u.MealKinds.Contains(req.MealType.Value))
                .OrderBy(u => u.RecipeName, StringComparer.OrdinalIgnoreCase)
                .Select(u => (Plan: plan, Usage: u)))
            .ToList();

        var page = pairs
            .Skip((req.Page - 1) * req.PageSize)
            .Take(req.PageSize)
            .ToList();

        var recipesById = await LoadRecipesAsync(page.Select(p => p.Usage.RecipeId).Distinct().ToList(), ct);
        var nutritionistNames = await LoadNutritionistNamesAsync(page.Select(p => p.Plan.NutritionistId).Distinct().ToList(), ct);

        var items = page.Select(pair =>
        {
            recipesById.TryGetValue(pair.Usage.RecipeId, out var recipe);
            var isCurrent = currentPlan is not null && currentPlan.ExternalId == pair.Plan.ExternalId;

            return BuildItem(pair.Plan, pair.Usage, recipe, nutritionistNames, isCurrent, todayUtc);
        }).ToList();

        HttpContext.Response.Headers["X-Total-Count"] = pairs.Count.ToString();

        await Send.OkAsync(new SearchClientRecipesResponse { Items = items }, ct);
    }

    private static ClientRecipeListItem BuildItem(
        NutritionPlan plan,
        VisibleRecipeUsage usage,
        Recipe? recipe,
        Dictionary<Guid, string> nutritionistNames,
        bool isCurrent,
        DateTime todayUtc)
    {
        var servings = recipe is null ? 1 : Math.Max(recipe.Servings, 1);
        var kcal = recipe is null ? usage.PerServing.Kcal : recipe.TotalNutrients.Kcal / servings;
        var protein = recipe is null ? usage.PerServing.Protein : recipe.TotalNutrients.Protein / servings;

        var currentWeek = isCurrent && plan.StartDate.HasValue
            ? (int)(todayUtc.Date - plan.StartDate.Value.Date).TotalDays / 7 + 1
            : (int?)null;

        return new ClientRecipeListItem
        {
            RecipeId = usage.RecipeId,
            Name = recipe?.Name ?? usage.RecipeName,
            MealKinds = usage.MealKinds.OrderBy(k => k).ToList(),
            MealTypes = recipe?.MealTypes ?? [],
            Kcal = Math.Round(kcal, 1),
            Protein = Math.Round(protein, 1),
            PrepTimeMinutes = recipe?.PrepTimeMinutes,
            ImageUrl = recipe?.ImageUrl,
            PlanId = plan.ExternalId,
            PlanName = plan.Name,
            NutritionistName = nutritionistNames.GetValueOrDefault(plan.NutritionistId, string.Empty),
            StartDate = plan.StartDate,
            EndDate = plan.StartDate?.AddDays(plan.Weeks.Count * 7 - 1),
            IsCurrentPlan = isCurrent,
            IsThisWeek = currentWeek.HasValue && usage.WeekNumbers.Contains(currentWeek.Value),
        };
    }

    private async Task<Dictionary<Guid, Recipe>> LoadRecipesAsync(List<Guid> recipeIds, CancellationToken ct)
    {
        if (recipeIds.Count == 0)
        {
            return [];
        }

        var filter = Builders<Recipe>.Filter.In(r => r.ExternalId, recipeIds);
        using var cursor = await mongo.Recipes.FindAsync(filter, cancellationToken: ct);
        var recipes = await cursor.ToListAsync(ct);

        return recipes.ToDictionary(r => r.ExternalId);
    }

    private async Task<Dictionary<Guid, string>> LoadNutritionistNamesAsync(List<Guid> userIds, CancellationToken ct)
    {
        if (userIds.Count == 0)
        {
            return [];
        }

        var users = await db.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.FirstName, u.LastName })
            .ToListAsync(ct);

        return users.ToDictionary(u => u.Id, u => $"{u.FirstName} {u.LastName}".Trim());
    }
}
