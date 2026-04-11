namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Status of a training plan.
/// </summary>
public enum TrainingPlanStatus
{
    /// <summary>
    /// Plan is being edited and not yet visible to the client.
    /// </summary>
    Draft,

    /// <summary>
    /// Plan is published and active for the client.
    /// </summary>
    Active,

    /// <summary>
    /// Plan has been completed by the professional (finished lifecycle).
    /// A new plan can now be created for the same client.
    /// </summary>
    Completed,

    /// <summary>
    /// Plan is no longer in use (soft-deleted).
    /// </summary>
    Archived
}
