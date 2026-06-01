namespace FitnessPlatform.Application.Features.TrainingPlans.UnlockTrainingSession;

/// <summary>
/// Request to acquire an Editing lock on a published training session.
/// </summary>
public class UnlockTrainingSessionRequest
{
    /// <summary>Training plan identifier.</summary>
    public Guid PlanId { get; set; }

    /// <summary>Session identifier to unlock for editing.</summary>
    public Guid SessionId { get; set; }
}
