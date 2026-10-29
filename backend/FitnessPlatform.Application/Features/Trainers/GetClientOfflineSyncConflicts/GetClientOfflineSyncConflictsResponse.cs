using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Trainers.GetClientOfflineSyncConflicts;

/// <summary>
/// One page of a client's offline-sync conflicts, newest first.
/// </summary>
public class GetClientOfflineSyncConflictsResponse
{
    /// <summary>The conflicts on this page.</summary>
    public List<OfflineSyncConflictDto> Items { get; set; } = [];
}

/// <summary>
/// A client action that collided with a plan change.
/// </summary>
public class OfflineSyncConflictDto
{
    /// <summary>Public id of the conflict.</summary>
    public Guid ConflictId { get; set; }

    /// <summary>Id of the plan the conflict belongs to.</summary>
    public Guid PlanId { get; set; }

    /// <summary>Plan name at sync time.</summary>
    public string PlanName { get; set; } = string.Empty;

    /// <summary>Name of the synced operation, e.g. <c>LogMealEaten</c>.</summary>
    public string Operation { get; set; } = string.Empty;

    /// <summary>Why the action collided with the plan.</summary>
    public OfflineSyncConflictKind Kind { get; set; }

    /// <summary>The meal the client acted on.</summary>
    public Guid MealId { get; set; }

    /// <summary>Meal kind at sync time.</summary>
    public MealKind MealKind { get; set; }

    /// <summary>False when the meal had left the plan, so no meal log was written.</summary>
    public bool MealLogged { get; set; }

    /// <summary>When the client performed the action offline (UTC).</summary>
    public DateTime OccurredAt { get; set; }

    /// <summary>The client's local calendar day of the action.</summary>
    public DateTime LogDate { get; set; }

    /// <summary>The plan version the client saw.</summary>
    public int BasedOnPlanVersion { get; set; }

    /// <summary>The plan version at sync time.</summary>
    public int CurrentPlanVersion { get; set; }

    /// <summary>When the conflict was detected (UTC).</summary>
    public DateTime DetectedAt { get; set; }

    /// <summary>Maps the stored document to the DTO.</summary>
    public static OfflineSyncConflictDto FromDocument(OfflineSyncConflict conflict) => new()
    {
        ConflictId = conflict.ExternalId,
        PlanId = conflict.PlanId,
        PlanName = conflict.PlanName,
        Operation = conflict.Operation,
        Kind = conflict.Kind,
        MealId = conflict.MealId,
        MealKind = conflict.MealKind,
        MealLogged = conflict.MealLogged,
        OccurredAt = conflict.OccurredAt,
        LogDate = conflict.LogDate,
        BasedOnPlanVersion = conflict.BasedOnPlanVersion,
        CurrentPlanVersion = conflict.CurrentPlanVersion,
        DetectedAt = conflict.DateCreated,
    };
}
