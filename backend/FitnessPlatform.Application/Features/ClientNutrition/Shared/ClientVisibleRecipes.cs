using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.Shared;

/// <summary>
/// The one rule deciding which recipes a client may see: a recipe is visible only when it appears
/// via <c>PlanMeal.Recipes[].RecipeId</c> in a Published week of a nutrition plan that belongs to
/// the client and is Active or Completed. Draft and Archived plans and unpublished weeks never leak.
/// </summary>
internal static class ClientVisibleRecipes
{
    private static readonly NutritionPlanStatus[] VisibleStatuses =
        [NutritionPlanStatus.Active, NutritionPlanStatus.Completed];

    /// <summary>
    /// Loads the client's plans whose status allows recipe visibility. Ownership is the
    /// <c>ClientId</c> equality; no other client's plan can be returned.
    /// </summary>
    public static async Task<List<NutritionPlan>> LoadVisiblePlansAsync(
        IMongoContext mongo, Guid clientId, CancellationToken ct)
    {
        var filter = Builders<NutritionPlan>.Filter.And(
            Builders<NutritionPlan>.Filter.Eq(p => p.ClientId, clientId),
            Builders<NutritionPlan>.Filter.In(p => p.Status, VisibleStatuses));

        using var cursor = await mongo.NutritionPlans.FindAsync(filter, cancellationToken: ct);
        var plans = await cursor.ToListAsync(ct);

        // Re-check in memory so the rule holds regardless of how the query was executed.
        return plans
            .Where(p => p.ClientId == clientId && VisibleStatuses.Contains(p.Status))
            .ToList();
    }

    /// <summary>
    /// Returns every distinct recipe used in the plan's Published weeks, with the weeks and meal
    /// kinds it appears in.
    /// </summary>
    public static List<VisibleRecipeUsage> GetUsages(NutritionPlan plan)
    {
        var usages = new Dictionary<Guid, VisibleRecipeUsage>();

        foreach (var week in plan.Weeks.Where(w => w.Status == WeekStatus.Published))
        {
            foreach (var meal in week.Days.SelectMany(d => d.Meals))
            {
                foreach (var recipe in meal.Recipes)
                {
                    if (!usages.TryGetValue(recipe.RecipeId, out var usage))
                    {
                        usage = new VisibleRecipeUsage(recipe.RecipeId, recipe.RecipeName, recipe.NutrientValuePerServing);
                        usages[recipe.RecipeId] = usage;
                    }

                    usage.WeekNumbers.Add(week.WeekNumber);
                    usage.MealKinds.Add(meal.Kind);
                }
            }
        }

        return usages.Values.ToList();
    }

    /// <summary>
    /// Whether <paramref name="recipeId"/> is visible through any of the given (already
    /// client-scoped) plans.
    /// </summary>
    public static bool IsVisible(IEnumerable<NutritionPlan> visiblePlans, Guid recipeId) =>
        visiblePlans.Any(plan => GetUsages(plan).Any(u => u.RecipeId == recipeId));
}

/// <summary>
/// One recipe as used in one plan's published weeks.
/// </summary>
/// <param name="RecipeId">The recipe's ExternalId.</param>
/// <param name="RecipeName">Name snapshot stored on the plan.</param>
/// <param name="PerServing">Nutrient snapshot per serving stored on the plan.</param>
internal sealed record VisibleRecipeUsage(Guid RecipeId, string RecipeName, NutrientValue PerServing)
{
    /// <summary>Published week numbers the recipe appears in.</summary>
    public HashSet<int> WeekNumbers { get; } = [];

    /// <summary>Meal kinds the recipe is planned under.</summary>
    public HashSet<MealKind> MealKinds { get; } = [];
}
