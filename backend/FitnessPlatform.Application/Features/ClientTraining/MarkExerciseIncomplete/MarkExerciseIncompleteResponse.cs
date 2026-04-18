namespace FitnessPlatform.Application.Features.ClientTraining.MarkExerciseIncomplete;

/// <summary>
/// Response for un-marking an exercise as complete.
/// </summary>
public class MarkExerciseIncompleteResponse
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
    /// Total number of exercises in this session (from the plan).
    /// </summary>
    public int TotalExerciseCount { get; set; }

    /// <summary>
    /// Whether every exercise in this session is still complete.
    /// </summary>
    public bool SessionComplete { get; set; }

    /// <summary>
    /// Current version of the underlying completion document.
    /// </summary>
    public int Version { get; set; }
}
