using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.WorkoutLogs.Shared;

/// <summary>
/// Full workout log detail DTO. Byte-stable wire shape — sourced from
/// <see cref="SessionExecution"/> (#841) instead of the retired standalone <c>WorkoutLog</c>.
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
    /// Maps a <see cref="SessionExecution"/> document (with non-null Performance) to a detail DTO.
    /// </summary>
    public static WorkoutLogDetail FromDocument(SessionExecution execution) => new()
    {
        LogId = execution.ExternalId,
        ClientId = execution.ClientId,
        PlanId = execution.PlanId,
        SessionId = execution.SessionId,
        StartedAt = execution.Performance?.StartedAt ?? execution.DateCreated,
        CompletedAt = execution.Performance?.CompletedAt,
        DurationSeconds = execution.Performance?.CompletedAt.HasValue == true
            ? (int)(execution.Performance.CompletedAt.Value - execution.Performance.StartedAt).TotalSeconds
            : null,
        Mood = execution.Performance?.Mood,
        Notes = execution.Performance?.Notes,
        IsCompleted = execution.Performance?.CompletedAt is not null,
        Exercises = execution.Exercises.ToList(),
        HasPR = execution.Exercises.Any(e => e.Sets.Any(s => s.IsPR))
    };
}
