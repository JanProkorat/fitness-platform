namespace FitnessPlatform.Application.Features.ClientTraining;

/// <summary>
/// Payload for the <c>trainingprogressupdated</c> SignalR event broadcast to the client's trainer
/// whenever the client marks an exercise or session complete or incomplete.
/// </summary>
public class TrainingProgressUpdatedEvent
{
    /// <summary>
    /// The client's public identifier (MongoDB clientId / ApplicationUser.Id).
    /// </summary>
    public Guid ClientId { get; set; }

    /// <summary>
    /// The session that was mutated.
    /// Null for <c>MarkWholeDayComplete</c> where multiple sessions may have been updated.
    /// </summary>
    public Guid? SessionId { get; set; }

    /// <summary>
    /// The calendar date for which the completion was recorded.
    /// </summary>
    public DateOnly Date { get; set; }

    /// <summary>
    /// How many exercises in the session are now marked complete.
    /// For multi-session operations (MarkWholeDayComplete) this reflects the
    /// aggregate count across all sessions updated in the request.
    /// </summary>
    public int CompletedExerciseCount { get; set; }

    /// <summary>
    /// Total number of exercises in the session (from the plan).
    /// For multi-session operations this reflects the aggregate total.
    /// </summary>
    public int TotalExerciseCount { get; set; }

    /// <summary>
    /// Whether every exercise in the session is now complete.
    /// For multi-session operations this is true only when all sessions are fully complete.
    /// </summary>
    public bool SessionComplete { get; set; }

    /// <summary>
    /// Combined compliance percentage for the client today (training + nutrition weighted).
    /// </summary>
    public decimal NewCompliancePercent { get; set; }

    /// <summary>
    /// Current consecutive-day streak for the client.
    /// </summary>
    public int NewStreak { get; set; }

    /// <summary>
    /// Number of training sessions the client has fully completed today.
    /// </summary>
    public int SessionsCompletedToday { get; set; }

    /// <summary>
    /// Number of training sessions planned for the client today.
    /// </summary>
    public int SessionsPlannedToday { get; set; }
}
