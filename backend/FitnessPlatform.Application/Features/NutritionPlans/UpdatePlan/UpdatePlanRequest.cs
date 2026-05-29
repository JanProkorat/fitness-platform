using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.NutritionPlans.UpdatePlan;

/// <summary>
/// Request for a full-state update of a nutrition plan: replaces name, settings, weeks/days/meals/foods, and supplements.
/// </summary>
public class UpdatePlanRequest
{
    /// <summary>
    /// The plan's public identifier (route parameter).
    /// </summary>
    public Guid PlanId { get; set; }

    /// <summary>
    /// Updated display name.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Updated global daily nutrition targets.
    /// </summary>
    public GlobalNutritionSettings? GlobalSettings { get; set; }

    /// <summary>
    /// Expected version for optimistic concurrency control.
    /// </summary>
    public int Version { get; set; }

    /// <summary>
    /// Full week structure to persist. Replaces all existing weeks, days, meals, and foods.
    /// </summary>
    public List<UpdateWeekRequest> Weeks { get; set; } = [];

    /// <summary>
    /// Updated start date. Must be a Monday and not in the past.
    /// Null clears the start date (only if it hasn't arrived and no weeks are published).
    /// </summary>
    public DateTime? StartDate { get; set; }

    /// <summary>
    /// Full supplement list to persist. Replaces all existing supplements.
    /// Omitting an entry removes that supplement (full-state replace pattern).
    /// </summary>
    public List<UpdateSupplementRequest> Supplements { get; set; } = [];
}

/// <summary>
/// Represents a single supplement entry submitted in a full-state plan update.
/// </summary>
public class UpdateSupplementRequest
{
    /// <summary>
    /// Stable public identifier for this supplement. Clients generate this on creation
    /// and send it back unchanged on subsequent updates so mobile reminder keys survive round-trips.
    /// When empty, the endpoint generates a new <see cref="Guid"/>.
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
    /// Optional additional notes for the client.
    /// </summary>
    public string? Notes { get; set; }
}
