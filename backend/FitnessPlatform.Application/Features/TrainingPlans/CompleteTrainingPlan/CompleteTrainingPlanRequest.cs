namespace FitnessPlatform.Application.Features.TrainingPlans.CompleteTrainingPlan;

/// <summary>
/// Request to mark a training plan as completed.
/// </summary>
public class CompleteTrainingPlanRequest
{
    /// <summary>Plan identifier.</summary>
    public Guid PlanId { get; set; }

    /// <summary>Optimistic concurrency version.</summary>
    public int Version { get; set; }
}
