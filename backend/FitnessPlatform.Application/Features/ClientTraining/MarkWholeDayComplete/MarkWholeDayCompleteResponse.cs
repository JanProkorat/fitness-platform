namespace FitnessPlatform.Application.Features.ClientTraining.MarkWholeDayComplete;

/// <summary>
/// Response for marking all training sessions on a day complete.
/// </summary>
public class MarkWholeDayCompleteResponse
{
    /// <summary>
    /// The date that was marked complete.
    /// </summary>
    public DateOnly Date { get; set; }

    /// <summary>
    /// Summary of each session that was processed.
    /// </summary>
    public List<SessionCompletionSummary> Sessions { get; set; } = [];
}

/// <summary>
/// Per-session completion summary returned by <see cref="MarkWholeDayCompleteResponse"/>.
/// </summary>
public class SessionCompletionSummary
{
    /// <summary>The session ID.</summary>
    public Guid SessionId { get; set; }

    /// <summary>Number of exercises marked complete in this session.</summary>
    public int CompletedExerciseCount { get; set; }

    /// <summary>Total exercises in the session.</summary>
    public int TotalExerciseCount { get; set; }

    /// <summary>Current document version for subsequent writes.</summary>
    public int Version { get; set; }
}
