namespace FitnessPlatform.Application.Features.Foods.Shared;

/// <summary>
/// Validation helpers for nutrient values.
/// </summary>
public static class NutrientValidation
{
    /// <summary>
    /// Validates that kcal ≈ protein×4 + carbs×4 + fat×9 + fibre×2, within 10% tolerance
    /// or a ±0.5 kcal allowance, whichever is looser. Returns true if the values are consistent.
    /// </summary>
    /// <param name="kcal">Stated kilocalories per 100 grams.</param>
    /// <param name="protein">Protein in grams per 100 grams.</param>
    /// <param name="carbs">Carbohydrates in grams per 100 grams.</param>
    /// <param name="fat">Fat in grams per 100 grams.</param>
    /// <param name="fiber">Fibre in grams per 100 grams; null is treated as zero.</param>
    public static bool IsKcalConsistent(decimal kcal, decimal protein, decimal carbs, decimal fat, decimal? fiber)
    {
        var fiberValue = fiber ?? 0;

        if (kcal == 0 && protein == 0 && carbs == 0 && fat == 0 && fiberValue == 0)
        {
            return true;
        }

        var computed = protein * 4 + carbs * 4 + fat * 9 + fiberValue * 2;

        if (Math.Abs(kcal - computed) <= 0.5m)
        {
            return true;
        }

        if (computed == 0)
        {
            return kcal == 0;
        }

        var ratio = kcal / computed;
        return ratio >= 0.9m && ratio <= 1.1m;
    }
}
