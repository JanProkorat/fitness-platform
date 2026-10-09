using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Interfaces;

namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.Shared;

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
    /// Computes the stats over the non-empty days (days with at least one meal) of the given days.
    /// </summary>
    /// <param name="days">All days across all weeks.</param>
    /// <param name="macroCalculator">Meal-totals calculator.</param>
    /// <returns>Most common meal count (ties resolve to the smaller) and whole-kcal average; both null when no day has a meal.</returns>
    public static (int? MealsPerDay, decimal? AvgKcalPerDay) Compute(
        IEnumerable<PlanDay> days,
        IMacroCalculatorService macroCalculator)
    {
        var nonEmptyDays = days.Where(day => day.Meals.Count > 0).ToList();

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
