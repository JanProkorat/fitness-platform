using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Service for calculating BMR, TDEE, macro targets, and recalculating plan totals.
/// </summary>
public interface IMacroCalculatorService
{
    /// <summary>
    /// Calculates Basal Metabolic Rate using the Mifflin-St Jeor equation.
    /// </summary>
    /// <param name="weightKilograms">Body weight in kilograms.</param>
    /// <param name="heightCentimeters">Height in centimeters.</param>
    /// <param name="age">Age in years.</param>
    /// <param name="sex">Biological sex.</param>
    /// <returns>BMR in kilocalories per day.</returns>
    decimal CalculateBmr(decimal weightKilograms, decimal heightCentimeters, int age, BiologicalSex sex);

    /// <summary>
    /// Calculates Total Daily Energy Expenditure from BMR and activity level.
    /// </summary>
    /// <param name="bmr">Basal Metabolic Rate in kcal.</param>
    /// <param name="activityLevel">Physical activity level.</param>
    /// <returns>TDEE in kilocalories per day.</returns>
    decimal CalculateTdee(decimal bmr, ActivityLevel activityLevel);

    /// <summary>
    /// Applies caloric adjustment based on the nutrition goal.
    /// </summary>
    /// <param name="tdee">Total Daily Energy Expenditure in kcal.</param>
    /// <param name="goal">Nutrition goal (Cut, Maintain, Bulk).</param>
    /// <returns>Adjusted daily kilocalories.</returns>
    decimal ApplyGoalAdjustment(decimal tdee, NutritionGoal goal);

    /// <summary>
    /// Calculates default macro split (30% protein, 45% carbs, 25% fat) from daily kcal target.
    /// </summary>
    /// <param name="dailyKcal">Target daily kilocalories.</param>
    /// <param name="proteinPercent">Protein percentage (default 30).</param>
    /// <param name="carbsPercent">Carbs percentage (default 45).</param>
    /// <param name="fatPercent">Fat percentage (default 25).</param>
    /// <returns>Macro targets in grams.</returns>
    GlobalNutritionSettings CalculateMacroSplit(
        decimal dailyKcal,
        decimal proteinPercent = 30m,
        decimal carbsPercent = 45m,
        decimal fatPercent = 25m);

    /// <summary>
    /// Calculates the Atwater energy from macronutrients: protein*4 + carbs*4 + fat*9.
    /// </summary>
    /// <param name="proteinGrams">Protein in grams.</param>
    /// <param name="carbsGrams">Carbs in grams.</param>
    /// <param name="fatGrams">Fat in grams.</param>
    /// <returns>Calculated kilocalories.</returns>
    decimal CalculateAtwaterKcal(decimal proteinGrams, decimal carbsGrams, decimal fatGrams);

    /// <summary>
    /// Recalculates all meal and day totals for a nutrition plan based on food amounts.
    /// </summary>
    /// <param name="plan">The plan to recalculate.</param>
    void RecalculateTotals(NutritionPlan plan);

    /// <summary>
    /// Sums nutrient totals across a list of foods and recipes, scaling by amount/servings.
    /// The single canonical meal-totals summation shared by the nutrition-plan meal-totals path
    /// (<see cref="RecalculateTotals"/>) and the meal-template sharing library (#859), so the
    /// same underlying foods/recipes always report identical totals whether they live inside a
    /// plan or inside a saved template.
    /// </summary>
    /// <param name="foods">The foods to sum, scaled by <see cref="MealFood.AmountGrams"/>.</param>
    /// <param name="recipes">The recipes to sum, scaled by <see cref="MealRecipe.Servings"/>.</param>
    /// <returns>Computed nutrient totals, rounded to one decimal place.</returns>
    NutrientTotals CalculateMealTotals(IReadOnlyList<MealFood> foods, IReadOnlyList<MealRecipe> recipes);
}
