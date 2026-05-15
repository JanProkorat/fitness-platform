namespace FitnessPlatform.Application.Features.ClientTraining.MarkSectionIncomplete;

/// <summary>
/// Response for un-marking a section as complete.
/// </summary>
public class MarkSectionIncompleteResponse
{
    /// <summary>
    /// The session ID that was updated.
    /// </summary>
    public Guid SessionId { get; set; }

    /// <summary>
    /// The section ID that was un-marked.
    /// </summary>
    public Guid SectionId { get; set; }

    /// <summary>
    /// The date for which the completion was removed.
    /// </summary>
    public DateOnly Date { get; set; }

    /// <summary>
    /// How many exercises in this session are now marked complete.
    /// </summary>
    public int CompletedExerciseCount { get; set; }

    /// <summary>
    /// Total number of exercises in this session (from the plan).
    /// </summary>
    public int TotalExerciseCount { get; set; }

    /// <summary>
    /// Current version of the underlying completion document (for subsequent writes).
    /// </summary>
    public int Version { get; set; }
}
