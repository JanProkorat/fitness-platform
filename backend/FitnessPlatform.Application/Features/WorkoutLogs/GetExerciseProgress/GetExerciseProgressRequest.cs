namespace FitnessPlatform.Application.Features.WorkoutLogs.GetExerciseProgress;

/// <summary>
/// Request to get a client's exercise progress over time.
/// </summary>
public class GetExerciseProgressRequest
{
    /// <summary>Client's public user identifier.</summary>
    public Guid ClientId { get; set; }

    /// <summary>Exercise's public identifier.</summary>
    public Guid ExerciseId { get; set; }
}
