namespace FitnessPlatform.Application.Features.TrainingPlans.DeleteTrainingPlan;

/// <summary>
/// Request to delete a training plan.
/// </summary>
public class DeleteTrainingPlanRequest
{
    /// <summary>
    /// The plan's public identifier.
    /// </summary>
    public Guid PlanId { get; set; }
}
