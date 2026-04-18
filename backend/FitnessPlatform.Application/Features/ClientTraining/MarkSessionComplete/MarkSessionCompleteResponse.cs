namespace FitnessPlatform.Application.Features.ClientTraining.MarkSessionComplete;

/// <summary>
/// Response for marking a whole session complete.
/// </summary>
public class MarkSessionCompleteResponse
{
    /// <summary>
    /// The session ID that was marked complete.
    /// </summary>
    public Guid SessionId { get; set; }

    /// <summary>
    /// The date for which the session was marked complete.
    /// </summary>
    public DateOnly Date { get; set; }

    /// <summary>
    /// Number of exercises now marked complete.
    /// </summary>
    public int CompletedExerciseCount { get; set; }

    /// <summary>
    /// Total exercises in the session.
    /// </summary>
    public int TotalExerciseCount { get; set; }

    /// <summary>
    /// Current document version.
    /// </summary>
    public int Version { get; set; }
}
