namespace FitnessPlatform.Application.Features.Exercises.DeleteExercise;

/// <summary>
/// Request model for deleting a custom exercise.
/// </summary>
public class DeleteExerciseRequest
{
    /// <summary>
    /// The public identifier of the exercise to delete.
    /// </summary>
    public Guid ExerciseId { get; set; }

    /// <summary>
    /// Optimistic concurrency version. Must match the current document version.
    /// </summary>
    public int Version { get; set; }
}
