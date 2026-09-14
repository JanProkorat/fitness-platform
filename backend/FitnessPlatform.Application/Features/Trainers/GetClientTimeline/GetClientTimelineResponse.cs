namespace FitnessPlatform.Application.Features.Trainers.GetClientTimeline;

/// <summary>
/// A single event in a client's activity timeline.
/// </summary>
public class ClientTimelineItem
{
    /// <summary>
    /// Stable unique identifier for this timeline entry.
    /// </summary>
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Event kind — used on the client to pick icon/colour.
    /// One of: meal_day, workout, measurement, questionnaire,
    /// nutrition_plan_published, training_plan_published, linked,
    /// personal_record.
    /// </summary>
    public string Type { get; set; } = string.Empty;

    /// <summary>
    /// When this event occurred (UTC).
    /// </summary>
    public DateTime OccurredAt { get; set; }

    /// <summary>
    /// Short, human-readable title (e.g. "Splnil jídelníček").
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Optional secondary text (e.g. "5 z 5 jídel zaznamenáno").
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Optional emoji/icon hint for the client.
    /// </summary>
    public string? Icon { get; set; }

    /// <summary>
    /// Structured payload for <c>personal_record</c> items.
    /// Null for all other event types.
    /// Exposed as typed fields so the web/mobile i18n layer can compose
    /// locale-specific copy without depending on server-side strings.
    /// </summary>
    public PersonalRecordPayload? PersonalRecord { get; set; }
}

/// <summary>
/// Structured payload embedded in a <c>personal_record</c> timeline item.
/// </summary>
public class PersonalRecordPayload
{
    /// <summary>Public-facing identifier of the personal record document.</summary>
    public Guid ExternalId { get; set; }

    /// <summary>ExternalId of the exercise for which the PR was achieved.</summary>
    public Guid ExerciseExternalId { get; set; }

    /// <summary>Snapshot of the exercise name at the time the PR was set.</summary>
    public string ExerciseName { get; set; } = string.Empty;

    /// <summary>Weight lifted in kilograms.</summary>
    public decimal WeightKg { get; set; }

    /// <summary>Repetitions completed in the PR set.</summary>
    public int Reps { get; set; }

    /// <summary>ExternalId of the workout log that contains this PR set.</summary>
    public Guid WorkoutLogId { get; set; }
}

/// <summary>
/// Response returning a client's activity timeline, ordered newest first.
/// </summary>
public class GetClientTimelineResponse
{
    /// <summary>
    /// Timeline items, ordered by <see cref="ClientTimelineItem.OccurredAt"/> descending.
    /// </summary>
    public List<ClientTimelineItem> Items { get; set; } = [];

    /// <summary>
    /// Whether the caller's link permits viewing the client's nutrition-domain timeline
    /// entries. Mirrors <c>ClientProfessionalLink.CanViewNutritionPlans</c>.
    /// </summary>
    public bool CanViewNutritionPlans { get; set; }

    /// <summary>
    /// Whether the caller's link permits viewing the client's training-domain timeline
    /// entries. Mirrors <c>ClientProfessionalLink.CanViewTrainingPlans</c>.
    /// </summary>
    public bool CanViewTrainingPlans { get; set; }
}
