using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.Shared;

/// <summary>
/// Deep-clones the nutrition plan/template content tree (weeks → days → meals → foods/recipes)
/// between a <see cref="NutritionPlanTemplate"/> and a <see cref="NutritionPlan"/>, and the
/// supplement list either direction copies. Centralizes the one instance-identity hazard in this
/// tree: <see cref="PlanMeal.MealId"/> is the only id below the week level (<see cref="PlanDay"/>
/// keys on <c>DayOfWeek</c>; <see cref="MealFood"/>/<see cref="MealRecipe"/> carry only
/// references — <see cref="MealFood.FoodExternalId"/> / <see cref="MealRecipe.RecipeId"/> — not
/// instance ids). <see cref="CloneWeeksAsPlan"/> mints a fresh <see cref="PlanMeal.MealId"/> for
/// every meal because <c>UpdatePlanValidator</c> rejects duplicate <c>MealId</c>s within a day
/// and <c>LogMealEatenEndpoint</c> resolves a meal by scanning <c>MealId</c> across the whole
/// plan — carrying the template's ids into a new plan would collide with any sibling plan
/// instantiated from the same template. The two other clone directions (template ↔ template,
/// plan → template) never mint fresh <c>MealId</c>s — they are not writing into a live,
/// meal-log-resolvable plan.
/// </summary>
internal static class TemplateContentCloner
{
    /// <summary>
    /// Clones a template's own week tree into a fresh, independent week tree for a new template
    /// (the <c>copy</c> endpoint). Meal ids are carried over verbatim — the source and the copy
    /// are two independent templates, never resolved by <c>MealId</c>.
    /// </summary>
    public static List<TemplateWeek> CloneWeeksAsTemplate(List<TemplateWeek> source) =>
        source.Select(week => new TemplateWeek
        {
            WeekNumber = week.WeekNumber,
            Days = CloneDays(week.Days, mintFreshMealIds: false)
        }).ToList();

    /// <summary>
    /// Clones an existing plan's week tree into a template's slim week shape (the
    /// <c>from-plan</c> endpoint). Drops <see cref="PlanWeek.Status"/> and
    /// <see cref="PlanWeek.DatePublished"/> — meaningless outside a client plan. Meal ids are
    /// carried over verbatim — the template is not itself resolved by <c>MealId</c>.
    /// </summary>
    public static List<TemplateWeek> CloneWeeksFromPlan(List<PlanWeek> source) =>
        source.Select(week => new TemplateWeek
        {
            WeekNumber = week.WeekNumber,
            Days = CloneDays(week.Days, mintFreshMealIds: false)
        }).ToList();

    /// <summary>
    /// Clones a template's week tree into a brand-new client plan's week tree (the
    /// <c>instantiate</c> endpoint). Every week is materialized <see cref="WeekStatus.Draft"/>,
    /// and every <see cref="PlanMeal.MealId"/> is freshly minted — see this type's class remarks
    /// for why that specific id must never be carried over here.
    /// </summary>
    public static List<PlanWeek> CloneWeeksAsPlan(List<TemplateWeek> source) =>
        source.Select(week => new PlanWeek
        {
            WeekNumber = week.WeekNumber,
            Status = WeekStatus.Draft,
            Days = CloneDays(week.Days, mintFreshMealIds: true)
        }).ToList();

    /// <summary>
    /// Clones the supplement list either direction. <paramref name="mintFreshExternalIds"/> is
    /// <see langword="true"/> for <c>instantiate</c> and <c>from-plan</c> (per issue #861's
    /// AC — advisory, not the <c>MealId</c> hazard class, but done anyway so a client's mobile
    /// reminder toggle never carries over from a re-instantiated template) and
    /// <see langword="false"/> for a template-to-template <c>copy</c>.
    /// </summary>
    public static List<Supplement> CloneSupplements(List<Supplement> source, bool mintFreshExternalIds) =>
        source.Select(supplement => new Supplement
        {
            ExternalId = mintFreshExternalIds ? Guid.NewGuid() : supplement.ExternalId,
            Name = supplement.Name,
            Dose = supplement.Dose,
            Notes = supplement.Notes
        }).ToList();

    private static List<PlanDay> CloneDays(List<PlanDay> source, bool mintFreshMealIds) =>
        source.Select(day => new PlanDay
        {
            DayOfWeek = day.DayOfWeek,
            Note = day.Note,
            DayTotals = day.DayTotals,
            Meals = day.Meals.Select(meal => new PlanMeal
            {
                MealId = mintFreshMealIds ? Guid.NewGuid() : meal.MealId,
                Kind = meal.Kind,
                Order = meal.Order,
                Time = meal.Time,
                Note = meal.Note,
                MealTotals = meal.MealTotals,
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
        }).ToList();
}
