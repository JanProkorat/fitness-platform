namespace FitnessPlatform.Application.Features.TrainingPlans.RelockTrainingSession;

/// <summary>
/// Request to release the Editing lock on a training session (relock it to Stable).
/// </summary>
public class RelockTrainingSessionRequest
{
    /// <summary>Training plan identifier.</summary>
    public Guid PlanId { get; set; }

    /// <summary>Session identifier to relock.</summary>
    public Guid SessionId { get; set; }
}
