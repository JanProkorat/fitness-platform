namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Categorises a <see cref="Entities.PlanPhoto"/> for display grouping and filtering in the app.
/// Maps to the three chips shown in the Fotky plánu gallery (Jídlo / Tělo / Volné).
/// </summary>
public enum PlanPhotoCategory
{
    /// <summary>Food-related photo (Jídlo) — linked to a meal log entry.</summary>
    Food,

    /// <summary>Body progress photo (Tělo) — the successor to the legacy ProgressPhoto.</summary>
    Body,

    /// <summary>Uncategorised / free-form photo (Volné) — not tied to a specific meal or body check-in.</summary>
    FreeForm,
}
