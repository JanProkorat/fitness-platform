namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Selects which plan types contribute to a compliance / streak calculation.
/// Maps to the viewer's professional role: a trainer sees training-only, a
/// nutritionist sees nutrition-only, a coach with both roles sees the combined value.
/// </summary>
public enum ComplianceDiscipline
{
    /// <summary>Include both nutrition and training plans.</summary>
    Both = 0,
    /// <summary>Ignore the nutrition plan; consider only training sessions.</summary>
    TrainingOnly = 1,
    /// <summary>Ignore the training plan; consider only logged meals.</summary>
    NutritionOnly = 2,
}
