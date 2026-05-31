namespace FitnessPlatform.Application.Features.TrainingPlans.FinishSession;

/// <summary>
/// Request for the trainer to retroactively finish a skipped or untouched session.
/// </summary>
public class FinishSessionRequest
{
    /// <summary>
    /// The training plan ExternalId (route parameter).
    /// </summary>
    public Guid PlanId { get; set; }

    /// <summary>
    /// The session identifier within the plan's weeks (route parameter).
    /// </summary>
    public Guid SessionId { get; set; }

    /// <summary>
    /// Optional backdated completion instant.
    /// When omitted the server uses <see cref="DateTime.UtcNow"/>.
    /// Must be in the past (or present) and not before the plan's start date.
    /// </summary>
    public DateTime? CompletedAt { get; set; }
}
