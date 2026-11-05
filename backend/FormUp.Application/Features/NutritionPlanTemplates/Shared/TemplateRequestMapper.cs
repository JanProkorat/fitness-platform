using FormUp.Application.Domain.Documents;
using FormUp.Application.Domain.Services;

namespace FormUp.Application.Features.NutritionPlanTemplates.Shared;

/// <summary>
/// Maps the caller-supplied request tree (<see cref="NutritionPlanTemplateWeekRequest"/> and
/// <see cref="TemplateSupplementRequest"/>) onto the document shapes persisted on a
/// <see cref="NutritionPlanTemplate"/>. Shared by <c>CreateTemplate</c> (when weeks are supplied
/// directly rather than materialized from a week count) and <c>UpdateTemplate</c>'s full-state
/// replace.
/// </summary>
internal static class TemplateRequestMapper
{
    /// <summary>
    /// Maps caller-supplied weeks, minting a fresh <see cref="PlanMeal.MealId"/> for any meal
    /// that doesn't already carry one — mirrors <c>UpdatePlanEndpoint.MutateAsync</c>'s
    /// <c>rm.MealId ?? Guid.NewGuid()</c> pattern. Item ids are carried over from the stored meal
    /// with the same id in <paramref name="storedWeeks"/> (see <see cref="MealItemIdResolver"/>);
    /// without stored weeks every item gets a new id.
    /// </summary>
    public static List<TemplateWeek> ToWeeks(
        List<NutritionPlanTemplateWeekRequest> weeks, List<TemplateWeek>? storedWeeks = null)
    {
        var storedMeals = (storedWeeks ?? [])
            .SelectMany(week => week.Days)
            .SelectMany(day => day.Meals)
            .GroupBy(meal => meal.MealId)
            .ToDictionary(group => group.Key, group => group.First());

        return weeks.Select(week => new TemplateWeek
        {
            WeekNumber = week.WeekNumber,
            Days = week.Days.Select(day => new PlanDay
            {
                DayOfWeek = day.DayOfWeek,
                Note = day.Note,
                Meals = day.Meals.Select(meal => ToMeal(meal, storedMeals)).ToList()
            }).ToList()
        }).ToList();
    }

    private static PlanMeal ToMeal(TemplateMealRequest meal, Dictionary<Guid, PlanMeal> storedMeals)
    {
        var mealId = meal.MealId ?? Guid.NewGuid();
        var stored = storedMeals.GetValueOrDefault(mealId);
        var foodIds = MealItemIdResolver.ResolveFoodIds(
            stored, meal.Foods.Select(food => (food.ItemId, food.FoodExternalId)).ToList());
        var recipeIds = MealItemIdResolver.ResolveRecipeIds(
            stored, meal.Recipes.Select(recipe => (recipe.ItemId, recipe.RecipeId)).ToList());

        return new PlanMeal
        {
            MealId = mealId,
            Kind = meal.Kind,
            Order = meal.Order,
            Time = meal.Time,
            Note = meal.Note,
            Foods = meal.Foods.Select((food, index) => new MealFood
            {
                ItemId = foodIds[index],
                FoodExternalId = food.FoodExternalId,
                FoodName = food.FoodName,
                FoodNameCs = food.FoodNameCs,
                FoodNameEn = food.FoodNameEn,
                FoodNameDe = food.FoodNameDe,
                FoodCategory = food.FoodCategory,
                NutrientValuePer100Grams = food.NutrientValuePer100Grams,
                AmountGrams = food.AmountGrams,
                Note = food.Note
            }).ToList(),
            Recipes = meal.Recipes.Select((recipe, index) => new MealRecipe
            {
                ItemId = recipeIds[index],
                RecipeId = recipe.RecipeId,
                RecipeName = recipe.RecipeName,
                NutrientValuePerServing = recipe.NutrientValuePerServing,
                Servings = recipe.Servings,
                Note = recipe.Note,
                FoodCategories = recipe.FoodCategories
            }).ToList()
        };
    }

    /// <summary>
    /// Materializes <paramref name="weekCount"/> empty weeks, each with all 7 <see cref="PlanDay"/>
    /// entries and no meals — mirrors <c>CreatePlanEndpoint.cs</c>'s empty-plan materialisation.
    /// </summary>
    public static List<TemplateWeek> ToEmptyWeeks(int weekCount) =>
        Enumerable.Range(1, weekCount).Select(weekNumber => new TemplateWeek
        {
            WeekNumber = weekNumber,
            Days = Enumerable.Range(1, 7).Select(dayOfWeek => new PlanDay
            {
                DayOfWeek = dayOfWeek,
                Meals = []
            }).ToList()
        }).ToList();

    /// <summary>
    /// Maps caller-supplied supplements, minting a fresh <see cref="Supplement.ExternalId"/> for
    /// any entry that doesn't already carry one.
    /// </summary>
    public static List<Supplement> ToSupplements(List<TemplateSupplementRequest> supplements) =>
        supplements.Select(supplement => new Supplement
        {
            ExternalId = supplement.ExternalId ?? Guid.NewGuid(),
            Name = supplement.Name,
            Dose = supplement.Dose,
            Notes = supplement.Notes
        }).ToList();
}
