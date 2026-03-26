namespace FitnessPlatform.Application.Features.WorkoutLogs.GetExerciseProgress;

/// <summary>
/// Time series of exercise performance data points.
/// </summary>
public class GetExerciseProgressResponse
{
    /// <summary>Exercise name.</summary>
    public string ExerciseName { get; set; } = string.Empty;

    /// <summary>Performance data points ordered by date.</summary>
    public List<ExerciseProgressPoint> DataPoints { get; set; } = [];
}

/// <summary>
/// A single data point of exercise performance.
/// </summary>
public class ExerciseProgressPoint
{
    /// <summary>Date of the workout.</summary>
    public DateTime Date { get; set; }

    /// <summary>Best weight used in this workout (kg).</summary>
    public decimal? BestWeightKg { get; set; }

    /// <summary>Best reps at best weight.</summary>
    public int? BestReps { get; set; }

    /// <summary>Total volume (sum of weight × reps across all sets).</summary>
    public decimal TotalVolume { get; set; }

    /// <summary>Whether any set was a PR.</summary>
    public bool HasPR { get; set; }
}
