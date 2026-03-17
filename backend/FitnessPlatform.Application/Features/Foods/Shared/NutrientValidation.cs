namespace FitnessPlatform.Application.Features.Foods.Shared;

/// <summary>
/// Validation helpers for nutrient values.
/// </summary>
public static class NutrientValidation
{
    /// <summary>
    /// Validates that kcal ≈ protein*4 + carbs*4 + fat*9 within 10% tolerance.
    /// Returns true if the values are consistent.
    /// </summary>
    /// <param name="kcal">Stated kilocalories per 100 grams.</param>
    /// <param name="protein">Protein in grams per 100 grams.</param>
    /// <param name="carbs">Carbohydrates in grams per 100 grams.</param>
    /// <param name="fat">Fat in grams per 100 grams.</param>
    public static bool IsKcalConsistent(decimal kcal, decimal protein, decimal carbs, decimal fat)
    {
        if (kcal == 0 && protein == 0 && carbs == 0 && fat == 0)
            return true;

        var computed = protein * 4 + carbs * 4 + fat * 9;

        if (computed == 0)
            return kcal == 0;

        var ratio = kcal / computed;
        return ratio >= 0.9m && ratio <= 1.1m;
    }
}
