namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.Shared;

/// <summary>
/// Represents a single supplement entry submitted when creating or full-state updating a
/// nutrition plan template.
/// </summary>
public class TemplateSupplementRequest
{
    /// <summary>
    /// Stable public identifier for this supplement. Clients generate this on creation and send
    /// it back unchanged on subsequent updates. When empty, the endpoint generates a new
    /// <see cref="Guid"/>.
    /// </summary>
    public Guid? ExternalId { get; set; }

    /// <summary>
    /// Name of the supplement (e.g. "Vitamin D3"). Required.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional dosage instruction in free text (e.g. "1 capsule with breakfast").
    /// </summary>
    public string? Dose { get; set; }

    /// <summary>
    /// Optional additional notes.
    /// </summary>
    public string? Notes { get; set; }
}
