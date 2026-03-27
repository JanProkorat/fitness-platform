using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Calculates BMR (Mifflin-St Jeor), TDEE, macro targets, and plan nutrient totals.
/// </summary>
public class MacroCalculatorService : IMacroCalculatorService
{
    /// <inheritdoc />
    public decimal CalculateBmr(decimal weightKilograms, decimal heightCentimeters, int age, BiologicalSex sex)
    {
        // Mifflin-St Jeor equation
        var baseBmr = 10m * weightKilograms + 6.25m * heightCentimeters - 5m * age;

        return sex == BiologicalSex.Male
            ? baseBmr + 5m
            : baseBmr - 161m;
    }

    /// <inheritdoc />
    public decimal CalculateTdee(decimal bmr, ActivityLevel activityLevel)
    {
        var factor = activityLevel switch
        {
            ActivityLevel.Sedentary => 1.2m,
            ActivityLevel.LightlyActive => 1.375m,
            ActivityLevel.ModeratelyActive => 1.55m,
            ActivityLevel.VeryActive => 1.725m,
            ActivityLevel.ExtremelyActive => 1.9m,
            _ => 1.2m
        };

        return Math.Round(bmr * factor, 0);
    }

    /// <inheritdoc />
    public decimal ApplyGoalAdjustment(decimal tdee, NutritionGoal goal)
    {
        var multiplier = goal switch
        {
            NutritionGoal.Cut => 0.80m,
            NutritionGoal.Maintain => 1.0m,
            NutritionGoal.Bulk => 1.10m,
            _ => 1.0m
        };

        return Math.Round(tdee * multiplier, 0);
    }

    /// <inheritdoc />
    public GlobalNutritionSettings CalculateMacroSplit(
        decimal dailyKcal,
        decimal proteinPercent = 30m,
        decimal carbsPercent = 45m,
        decimal fatPercent = 25m)
    {
        return new GlobalNutritionSettings
        {
            DailyKcal = Math.Round(dailyKcal, 0),
            ProteinGrams = Math.Round(dailyKcal * proteinPercent / 100m / 4m, 0),
            CarbsGrams = Math.Round(dailyKcal * carbsPercent / 100m / 4m, 0),
            FatGrams = Math.Round(dailyKcal * fatPercent / 100m / 9m, 0)
        };
    }

    /// <inheritdoc />
    public decimal CalculateAtwaterKcal(decimal proteinGrams, decimal carbsGrams, decimal fatGrams)
    {
        return proteinGrams * 4m + carbsGrams * 4m + fatGrams * 9m;
    }

    /// <inheritdoc />
    public void RecalculateTotals(NutritionPlan plan)
    {
        foreach (var week in plan.Weeks)
        {
            foreach (var day in week.Days)
            {
                foreach (var meal in day.Meals)
                {
                    meal.MealTotals = CalculateMealTotals(meal);
                }

                day.DayTotals = CalculateDayTotals(day);
            }
        }
    }

    /// <summary>
    /// Sums nutrient totals across all foods in a meal, scaling by amount.
    /// </summary>
    private static NutrientTotals CalculateMealTotals(PlanMeal meal)
    {
        var totals = new NutrientTotals();

        foreach (var food in meal.Foods)
        {
            var ratio = food.AmountGrams / 100m;
            totals.Kcal += food.NutrientValuePer100Grams.Kcal * ratio;
            totals.Protein += food.NutrientValuePer100Grams.Protein * ratio;
            totals.Carbs += food.NutrientValuePer100Grams.Carbs * ratio;
            totals.Fat += food.NutrientValuePer100Grams.Fat * ratio;
        }

        foreach (var recipe in meal.Recipes)
        {
            totals.Kcal += recipe.NutrientValuePerServing.Kcal * recipe.Servings;
            totals.Protein += recipe.NutrientValuePerServing.Protein * recipe.Servings;
            totals.Carbs += recipe.NutrientValuePerServing.Carbs * recipe.Servings;
            totals.Fat += recipe.NutrientValuePerServing.Fat * recipe.Servings;
        }

        totals.Kcal = Math.Round(totals.Kcal, 1);
        totals.Protein = Math.Round(totals.Protein, 1);
        totals.Carbs = Math.Round(totals.Carbs, 1);
        totals.Fat = Math.Round(totals.Fat, 1);

        return totals;
    }

    /// <summary>
    /// Sums nutrient totals across all meals in a day.
    /// </summary>
    private static NutrientTotals CalculateDayTotals(PlanDay day)
    {
        var totals = new NutrientTotals();

        foreach (var meal in day.Meals)
        {
            if (meal.MealTotals is null) continue;

            totals.Kcal += meal.MealTotals.Kcal;
            totals.Protein += meal.MealTotals.Protein;
            totals.Carbs += meal.MealTotals.Carbs;
            totals.Fat += meal.MealTotals.Fat;
        }

        totals.Kcal = Math.Round(totals.Kcal, 1);
        totals.Protein = Math.Round(totals.Protein, 1);
        totals.Carbs = Math.Round(totals.Carbs, 1);
        totals.Fat = Math.Round(totals.Fat, 1);

        return totals;
    }
}
