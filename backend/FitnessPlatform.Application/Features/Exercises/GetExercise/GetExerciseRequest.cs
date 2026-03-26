namespace FitnessPlatform.Application.Features.Exercises.GetExercise;

/// <summary>
/// Request model for retrieving a single exercise.
/// </summary>
public class GetExerciseRequest
{
    /// <summary>
    /// The public identifier of the exercise.
    /// </summary>
    public Guid ExerciseId { get; set; }
}
