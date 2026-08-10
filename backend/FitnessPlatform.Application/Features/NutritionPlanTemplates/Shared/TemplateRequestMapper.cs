using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.Shared;

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
    /// <c>rm.MealId ?? Guid.NewGuid()</c> pattern.
    /// </summary>
    public static List<TemplateWeek> ToWeeks(List<NutritionPlanTemplateWeekRequest> weeks) =>
        weeks.Select(week => new TemplateWeek
        {
            WeekNumber = week.WeekNumber,
            Days = week.Days.Select(day => new PlanDay
            {
                DayOfWeek = day.DayOfWeek,
                Note = day.Note,
                Meals = day.Meals.Select(meal => new PlanMeal
                {
                    MealId = meal.MealId ?? Guid.NewGuid(),
                    Kind = meal.Kind,
                    Order = meal.Order,
                    Time = meal.Time,
                    Note = meal.Note,
                    Foods = meal.Foods.Select(food => new MealFood
                    {
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
                    Recipes = meal.Recipes.Select(recipe => new MealRecipe
                    {
                        RecipeId = recipe.RecipeId,
                        RecipeName = recipe.RecipeName,
                        NutrientValuePerServing = recipe.NutrientValuePerServing,
                        Servings = recipe.Servings,
                        Note = recipe.Note,
                        FoodCategories = recipe.FoodCategories
                    }).ToList()
                }).ToList()
            }).ToList()
        }).ToList();

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
