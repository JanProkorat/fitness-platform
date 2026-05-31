namespace FitnessPlatform.Application.Features.TrainingPlans.FinishSession;

/// <summary>
/// Response after a trainer successfully finishes a session.
/// </summary>
public class FinishSessionResponse
{
    /// <summary>
    /// The workout log ExternalId that was created or completed.
    /// </summary>
    public Guid WorkoutLogId { get; set; }

    /// <summary>
    /// The plan ExternalId.
    /// </summary>
    public Guid PlanId { get; set; }

    /// <summary>
    /// The session identifier within the plan.
    /// </summary>
    public Guid SessionId { get; set; }

    /// <summary>
    /// The instant the session was marked as completed (the effective completedAt value used).
    /// </summary>
    public DateTime CompletedAt { get; set; }
}
