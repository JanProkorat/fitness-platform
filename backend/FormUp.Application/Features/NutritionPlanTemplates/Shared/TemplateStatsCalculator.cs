using FormUp.Application.Domain.Documents;
using FormUp.Application.Domain.Interfaces;

namespace FormUp.Application.Features.NutritionPlanTemplates.Shared;

/// <summary>
/// Computes the denormalized list stats (<see cref="NutritionPlanTemplate.MealsPerDay"/>,
/// <see cref="NutritionPlanTemplate.AvgKcalPerDay"/>) from a week tree. Kcal comes from
/// <see cref="IMacroCalculatorService.CalculateMealTotals"/>, never the stored day totals.
/// </summary>
public static class TemplateStatsCalculator
{
    /// <summary>
    /// Computes both stats and assigns them to <paramref name="template"/>.
    /// </summary>
    /// <param name="template">Template whose <c>Weeks</c> are already set.</param>
    /// <param name="macroCalculator">Meal-totals calculator.</param>
    public static void Apply(NutritionPlanTemplate template, IMacroCalculatorService macroCalculator)
    {
        var (mealsPerDay, avgKcalPerDay) = Compute(template.Weeks.SelectMany(week => week.Days), macroCalculator);

        template.MealsPerDay = mealsPerDay;
        template.AvgKcalPerDay = avgKcalPerDay;
    }

    /// <summary>
    /// Computes the stats over the non-empty days of the given days. A day is non-empty when at least
    /// one of its meals has a food or a recipe; meal rows with neither do not count.
    /// </summary>
    /// <param name="days">All days across all weeks.</param>
    /// <param name="macroCalculator">Meal-totals calculator.</param>
    /// <returns>Most common meal count (ties resolve to the smaller) and whole-kcal average; both null when no day has a food or recipe.</returns>
    public static (int? MealsPerDay, decimal? AvgKcalPerDay) Compute(
        IEnumerable<PlanDay> days,
        IMacroCalculatorService macroCalculator)
    {
        var nonEmptyDays = days.Where(day => day.Meals.Any(meal => meal.Foods.Count + meal.Recipes.Count > 0)).ToList();

        if (nonEmptyDays.Count == 0)
        {
            return (null, null);
        }

        var mealsPerDay = nonEmptyDays
            .GroupBy(day => day.Meals.Count)
            .OrderByDescending(group => group.Count())
            .ThenBy(group => group.Key)
            .First()
            .Key;

        var totalKcal = nonEmptyDays.Sum(day => day.Meals.Sum(meal =>
            macroCalculator.CalculateMealTotals(meal.Foods, meal.Recipes).Kcal));

        var avgKcalPerDay = Math.Round(totalKcal / nonEmptyDays.Count, 0, MidpointRounding.AwayFromZero);

        return (mealsPerDay, avgKcalPerDay);
    }
}
