namespace FitnessPlatform.Application.Features.TrainingPlans.UpdateTrainingPlan;

/// <summary>
/// Request for a full-state update of a training plan.
/// </summary>
public class UpdateTrainingPlanRequest
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
    /// Updated plan description.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Expected version for optimistic concurrency control.
    /// </summary>
    public int Version { get; set; }

    /// <summary>
    /// Full week structure to persist.
    /// </summary>
    public List<UpdateTrainingWeekRequest> Weeks { get; set; } = [];

    /// <summary>
    /// Updated start date. Must be a Monday and not in the past.
    /// </summary>
    public DateTime? StartDate { get; set; }
}
