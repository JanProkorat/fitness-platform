namespace FitnessPlatform.Application.Features.ClientTraining.MarkExerciseComplete;

/// <summary>
/// Request model for marking a single exercise complete within a session.
/// </summary>
public class MarkExerciseCompleteRequest
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
    /// inside a workout — so a catalog exercise programmed twice within the same workout (or once
    /// standalone and once nested) is unambiguous. Replaces the pre-#857-phase-3b
    /// <c>ExerciseExternalId</c> + <c>WorkoutId</c> pair, which could not disambiguate that case.
    /// </remarks>
    public Guid ExerciseId { get; set; }

    /// <summary>
    /// The date on which the exercise was completed (UTC date only).
    /// Defaults to today UTC when not provided.
    /// </summary>
    public DateOnly? CompletedOn { get; set; }

    /// <summary>
    /// Client-supplied version of the existing completion document, used for optimistic
    /// concurrency. Required when a completion document already exists for this
    /// (clientId, date, sessionId) tuple; ignored for new documents.
    /// </summary>
    public int? Version { get; set; }
}
