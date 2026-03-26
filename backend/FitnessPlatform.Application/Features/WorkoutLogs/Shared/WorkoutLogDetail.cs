using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.WorkoutLogs.Shared;

/// <summary>
/// Full workout log detail DTO.
/// </summary>
public class WorkoutLogDetail
{
    /// <summary>Workout log public identifier.</summary>
    public Guid LogId { get; set; }

    /// <summary>Client's user ID.</summary>
    public Guid ClientId { get; set; }

    /// <summary>Training plan reference.</summary>
    public Guid? PlanId { get; set; }

    /// <summary>Training session reference.</summary>
    public Guid? SessionId { get; set; }

    /// <summary>When the workout started.</summary>
    public DateTime StartedAt { get; set; }

    /// <summary>When the workout was completed.</summary>
    public DateTime? CompletedAt { get; set; }

    /// <summary>Duration in seconds (null if not completed).</summary>
    public int? DurationSeconds { get; set; }

    /// <summary>Client mood (1-5).</summary>
    public int? Mood { get; set; }

    /// <summary>Client notes.</summary>
    public string? Notes { get; set; }

    /// <summary>Whether the workout is completed.</summary>
    public bool IsCompleted { get; set; }

    /// <summary>Exercises performed.</summary>
    public List<WorkoutExercise> Exercises { get; set; } = [];

    /// <summary>Whether any set in this workout is a PR.</summary>
    public bool HasPR { get; set; }

    /// <summary>
    /// Maps a <see cref="WorkoutLog"/> document to a detail DTO.
    /// </summary>
    public static WorkoutLogDetail FromDocument(WorkoutLog log) => new()
    {
        LogId = log.ExternalId,
        ClientId = log.ClientId,
        PlanId = log.PlanId,
        SessionId = log.SessionId,
        StartedAt = log.StartedAt,
        CompletedAt = log.CompletedAt,
        DurationSeconds = log.CompletedAt.HasValue
            ? (int)(log.CompletedAt.Value - log.StartedAt).TotalSeconds
            : null,
        Mood = log.Mood,
        Notes = log.Notes,
        IsCompleted = log.IsCompleted,
        Exercises = log.Exercises,
        HasPR = log.Exercises.Any(e => e.Sets.Any(s => s.IsPR))
    };
}
