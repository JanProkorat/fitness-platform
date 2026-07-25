using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.WorkoutLogs.Shared;

/// <summary>
/// Lightweight workout log summary for list views. Byte-stable wire shape — sourced from
/// <see cref="SessionExecution"/> (#841) instead of the retired standalone <c>WorkoutLog</c>.
/// </summary>
public class WorkoutLogSummary
{
    /// <summary>Workout log public identifier.</summary>
    public Guid LogId { get; set; }

    /// <summary>When the workout started.</summary>
    public DateTime StartedAt { get; set; }

    /// <summary>When the workout was completed.</summary>
    public DateTime? CompletedAt { get; set; }

    /// <summary>Duration in seconds.</summary>
    public int? DurationSeconds { get; set; }

    /// <summary>Client mood (1-5).</summary>
    public int? Mood { get; set; }

    /// <summary>Whether the workout is completed.</summary>
    public bool IsCompleted { get; set; }

    /// <summary>Number of exercises performed.</summary>
    public int ExerciseCount { get; set; }

    /// <summary>Total number of sets performed.</summary>
    public int SetCount { get; set; }

    /// <summary>Whether any set is a PR.</summary>
    public bool HasPR { get; set; }

    /// <summary>
    /// Maps a <see cref="SessionExecution"/> document (with non-null Performance) to a summary DTO.
    /// </summary>
    public static WorkoutLogSummary FromDocument(SessionExecution execution) => new()
    {
        LogId = execution.ExternalId,
        StartedAt = execution.Performance?.StartedAt ?? execution.DateCreated,
        CompletedAt = execution.Performance?.CompletedAt,
        DurationSeconds = execution.Performance?.CompletedAt.HasValue == true
            ? (int)(execution.Performance.CompletedAt.Value - execution.Performance.StartedAt).TotalSeconds
            : null,
        Mood = execution.Performance?.Mood,
        IsCompleted = execution.Performance?.CompletedAt is not null,
        ExerciseCount = execution.Exercises.Count,
        SetCount = execution.Exercises.Sum(e => e.Sets.Count),
        HasPR = execution.Exercises.Any(e => e.Sets.Any(s => s.IsPR))
    };
}
