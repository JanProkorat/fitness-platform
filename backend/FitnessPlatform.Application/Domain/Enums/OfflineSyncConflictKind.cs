namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Why an offline-synced client action collided with the coach's plan.
/// </summary>
public enum OfflineSyncConflictKind
{
    /// <summary>The meal was edited (added, re-composed or moved) after the client's snapshot.</summary>
    PlanChanged,

    /// <summary>The meal is no longer part of the client's current plan.</summary>
    MealRemoved,
}
