using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.WorkoutLogs.Shared;

/// <summary>
/// Lightweight workout log summary for list views.
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
    /// Maps a <see cref="WorkoutLog"/> document to a summary DTO.
    /// </summary>
    public static WorkoutLogSummary FromDocument(WorkoutLog log) => new()
    {
        LogId = log.ExternalId,
        StartedAt = log.StartedAt,
        CompletedAt = log.CompletedAt,
        DurationSeconds = log.CompletedAt.HasValue
            ? (int)(log.CompletedAt.Value - log.StartedAt).TotalSeconds
            : null,
        Mood = log.Mood,
        IsCompleted = log.IsCompleted,
        ExerciseCount = log.Exercises.Count,
        SetCount = log.Exercises.Sum(e => e.Sets.Count),
        HasPR = log.Exercises.Any(e => e.Sets.Any(s => s.IsPR))
    };
}
