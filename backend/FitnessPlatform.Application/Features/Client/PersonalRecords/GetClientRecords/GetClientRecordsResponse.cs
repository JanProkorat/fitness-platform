namespace FitnessPlatform.Application.Features.Client.PersonalRecords.GetClientRecords;

/// <summary>
/// Response for the GET /client/records endpoint.
/// The total count of matching records is returned in the X-Total-Count response header.
/// </summary>
public class GetClientRecordsResponse
{
    /// <summary>Page of personal record summaries, sorted by AchievedAt descending.</summary>
    public IReadOnlyList<PersonalRecordSummary> Items { get; init; } = [];
}

/// <summary>
/// Summary DTO for a single personal record.
/// </summary>
public class PersonalRecordSummary
{
    /// <summary>Public-facing identifier of this personal record.</summary>
    public Guid ExternalId { get; init; }

    /// <summary>ExternalId of the exercise for which the PR was achieved.</summary>
    public Guid ExerciseExternalId { get; init; }

    /// <summary>Snapshot of the exercise name at the time the PR was achieved.</summary>
    public string ExerciseName { get; init; } = string.Empty;

    /// <summary>Weight lifted in kilograms.</summary>
    public decimal WeightKg { get; init; }

    /// <summary>Repetitions completed in the PR set.</summary>
    public int Reps { get; init; }

    /// <summary>When the personal record was achieved (UTC).</summary>
    public DateTime AchievedAt { get; init; }

    /// <summary>ExternalId of the workout log that contains this PR set.</summary>
    public Guid WorkoutLogId { get; init; }
}
