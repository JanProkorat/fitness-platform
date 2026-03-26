namespace FitnessPlatform.Application.Features.TrainingPlans.GetTrainingPlan;

/// <summary>
/// Request to retrieve a single training plan.
/// </summary>
public class GetTrainingPlanRequest
{
    /// <summary>
    /// The plan's public identifier.
    /// </summary>
    public Guid PlanId { get; set; }
}
