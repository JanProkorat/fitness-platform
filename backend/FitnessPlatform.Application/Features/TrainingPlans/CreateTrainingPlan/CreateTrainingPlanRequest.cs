namespace FitnessPlatform.Application.Features.TrainingPlans.CreateTrainingPlan;

/// <summary>
/// Request to create a new training plan for a client.
/// </summary>
public class CreateTrainingPlanRequest
{
    /// <summary>
    /// The client's public user identifier.
    /// </summary>
    public Guid ClientId { get; set; }

    /// <summary>
    /// Display name of the plan.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional plan description.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Number of weeks to initialize (default 1).
    /// </summary>
    public int WeekCount { get; set; } = 1;

    /// <summary>
    /// Optional start date for the plan. Must be a Monday and not in the past.
    /// </summary>
    public DateTime? StartDate { get; set; }
}
