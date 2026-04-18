namespace FitnessPlatform.Application.Features.ClientTraining.MarkSessionIncomplete;

/// <summary>
/// Response for un-marking a training session as complete.
/// </summary>
public class MarkSessionIncompleteResponse
{
    /// <summary>
    /// The session ID that was updated.
    /// </summary>
    public Guid SessionId { get; set; }

    /// <summary>
    /// The date for which the completion was removed.
    /// </summary>
    public DateOnly Date { get; set; }

    /// <summary>
    /// How many exercises in this session are still marked complete.
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
