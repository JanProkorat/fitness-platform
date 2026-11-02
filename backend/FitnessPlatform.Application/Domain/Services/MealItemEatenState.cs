using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Services;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Reads the per-item eaten state of a plan meal off its <see cref="MealLog"/> rows. Shared by the
/// log readers and the item tick endpoints so the "all items eaten" rule lives in one place.
/// </summary>
internal static class MealItemEatenState
{
    /// <summary>
    /// The ids of every food and recipe of the meal.
    /// </summary>
    public static HashSet<Guid> ItemIds(PlanMeal meal) =>
        meal.Foods.Select(food => food.ItemId)
            .Concat(meal.Recipes.Select(recipe => recipe.ItemId))
            .ToHashSet();

    /// <summary>
    /// The item ids a row counts as eaten. A legacy row (eaten, but written before item ticks
    /// existed) counts as every item of the meal; stored ids no longer in the meal are dropped.
    /// </summary>
    public static HashSet<Guid> EffectiveEatenIds(MealLog row, PlanMeal? meal)
    {
        if (row.EatenAt is not null && row.EatenItemIds.Count == 0)
        {
            return meal is null ? [] : ItemIds(meal);
        }

        var eaten = row.EatenItemIds.ToHashSet();

        if (meal is not null)
        {
            eaten.IntersectWith(ItemIds(meal));
        }

        return eaten;
    }

    /// <summary>
    /// The eaten state of a meal given the ids counted as eaten and whether a row marks it eaten.
    /// A meal with no items is eaten exactly when a row says so.
    /// </summary>
    public static MealEatenState StateOf(PlanMeal? meal, IReadOnlyCollection<Guid> eatenIds, bool markedEaten)
    {
        var items = meal is null ? [] : ItemIds(meal);

        if (items.Count == 0)
        {
            if (markedEaten)
            {
                return MealEatenState.Eaten;
            }

            return eatenIds.Count > 0 ? MealEatenState.PartlyEaten : MealEatenState.NotEaten;
        }

        var eatenCount = items.Count(eatenIds.Contains);

        if (eatenCount == 0)
        {
            return MealEatenState.NotEaten;
        }

        return eatenCount == items.Count ? MealEatenState.Eaten : MealEatenState.PartlyEaten;
    }

    /// <summary>
    /// The share of the meal eaten, in [0, 1]: eaten current items over current items. A meal with
    /// no items is 1 when a row marks it eaten and 0 otherwise.
    /// </summary>
    public static decimal EatenShare(PlanMeal? meal, IReadOnlyCollection<Guid> eatenIds, bool markedEaten = false)
    {
        var items = meal is null ? [] : ItemIds(meal);

        if (items.Count == 0)
        {
            return markedEaten ? 1m : 0m;
        }

        return (decimal)items.Count(eatenIds.Contains) / items.Count;
    }

    /// <summary>
    /// Nutrient totals of just the eaten items of the live plan meal.
    /// </summary>
    public static NutrientTotals EatenTotals(PlanMeal meal, IReadOnlyCollection<Guid> eatenIds) =>
        new MacroCalculatorService().CalculateMealTotals(
            meal.Foods.Where(food => eatenIds.Contains(food.ItemId)).ToList(),
            meal.Recipes.Where(recipe => eatenIds.Contains(recipe.ItemId)).ToList());
}
