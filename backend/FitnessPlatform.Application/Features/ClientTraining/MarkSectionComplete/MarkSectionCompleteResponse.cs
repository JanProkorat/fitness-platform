namespace FitnessPlatform.Application.Features.ClientTraining.MarkSectionComplete;

/// <summary>
/// Response for marking a section complete.
/// Returns a lightweight progress summary so the mobile client can update
/// section progress indicators without an extra round-trip.
/// </summary>
public class MarkSectionCompleteResponse
{
    /// <summary>
    /// The session ID that was updated.
    /// </summary>
    public Guid SessionId { get; set; }

    /// <summary>
    /// The section ID that was marked complete.
    /// </summary>
    public Guid SectionId { get; set; }

    /// <summary>
    /// The date for which the completion was recorded.
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
