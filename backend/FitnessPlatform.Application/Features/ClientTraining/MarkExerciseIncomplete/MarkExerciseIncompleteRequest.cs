namespace FitnessPlatform.Application.Features.ClientTraining.MarkExerciseIncomplete;

/// <summary>
/// Request model for un-marking a single exercise as complete.
/// </summary>
public class MarkExerciseIncompleteRequest
{
    /// <summary>
    /// The session ID (from the training plan). Bound from the route.
    /// </summary>
    public Guid SessionId { get; set; }

    /// <summary>
    /// The exercise instance ID (<see cref="Domain.Documents.SessionExercise.ExerciseId"/>) within
    /// the session. Bound from the route.
    /// </summary>
    /// <remarks>
    /// #857 phase 3b: identifies the specific exercise occurrence directly — standalone or nested
    /// inside a workout — so un-marking only affects that one instance, leaving other instances of
    /// the same catalog exercise (in a different workout, or standalone vs. nested) untouched.
    /// Replaces the pre-#857-phase-3b <c>ExerciseExternalId</c> + <c>WorkoutId</c> pair.
    /// </remarks>
    public Guid ExerciseId { get; set; }

    /// <summary>
    /// The date for which the completion should be removed (UTC date only).
    /// Defaults to today UTC when not provided.
    /// </summary>
    public DateOnly? CompletedOn { get; set; }

    /// <summary>
    /// Client-supplied version of the completion document for optimistic concurrency.
    /// </summary>
    public int? Version { get; set; }
}
