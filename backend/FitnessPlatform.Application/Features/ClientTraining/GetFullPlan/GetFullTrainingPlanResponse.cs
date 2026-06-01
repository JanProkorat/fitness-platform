using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.ClientTraining.GetFullPlan;

/// <summary>
/// Full training plan response for the client mobile view.
/// Contains all published weeks enriched with completion state and muscle group data.
/// </summary>
public class GetFullTrainingPlanResponse
{
    /// <summary>External identifier of the training plan.</summary>
    public Guid PlanId { get; set; }

    /// <summary>Display name of the training plan.</summary>
    public string PlanName { get; set; } = "";

    /// <summary>Plan status (Draft, Active, Completed, Archived).</summary>
    public string Status { get; set; } = "";

    /// <summary>The Monday when Week 1 begins, if set.</summary>
    public DateTime? StartDate { get; set; }

    /// <summary>Current week number (null if plan is upcoming).</summary>
    public int? CurrentWeek { get; set; }

    /// <summary>Total number of weeks in the plan (including draft).</summary>
    public int TotalWeeks { get; set; }

    /// <summary>Number of published weeks.</summary>
    public int PublishedWeekCount { get; set; }

    /// <summary>Linked questionnaire response public ID, if any.</summary>
    public Guid? QuestionnaireResponseId { get; set; }

    /// <summary>When this plan was marked as completed, if applicable.</summary>
    public DateTime? DateCompleted { get; set; }

    /// <summary>Published weeks with sessions and completion state.</summary>
    public List<WeekDto> Weeks { get; set; } = [];
}

/// <summary>
/// A published week within the training plan.
/// </summary>
public class WeekDto
{
    /// <summary>1-based week number.</summary>
    public int WeekNumber { get; set; }

    /// <summary>Week publish status (Draft, Published).</summary>
    public string Status { get; set; } = "";

    /// <summary>When this week was published.</summary>
    public DateTime? DatePublished { get; set; }

    /// <summary>
    /// Start date (Monday) of this week, computed from plan.StartDate + (weekNumber-1)*7 days.
    /// Null when no anchor date is available.
    /// </summary>
    public DateTime? WeekStartDate { get; set; }

    /// <summary>
    /// End date (Sunday) of this week. Null when no anchor date is available.
    /// </summary>
    public DateTime? WeekEndDate { get; set; }

    /// <summary>Optional day-level notes keyed by day of week (1=Monday … 7=Sunday).</summary>
    public Dictionary<int, string> DayNotes { get; set; } = new();

    /// <summary>Sessions in this week.</summary>
    public List<SessionDto> Sessions { get; set; } = [];
}

/// <summary>
/// A single training session within a week.
/// </summary>
public class SessionDto
{
    /// <summary>Unique session identifier.</summary>
    public Guid SessionId { get; set; }

    /// <summary>Day of the week (1 = Monday, 7 = Sunday).</summary>
    public int DayOfWeek { get; set; }

    /// <summary>Display name of the session (e.g. "Push Day").</summary>
    public string Name { get; set; } = "";

    /// <summary>Display order within the day.</summary>
    public int Order { get; set; }

    /// <summary>Optional coach notes for this session.</summary>
    public string? Notes { get; set; }

    /// <summary>Number of exercises where all planned sets are completed.</summary>
    public int CompletedExerciseCount { get; set; }

    /// <summary>Total number of exercises in this session.</summary>
    public int TotalExerciseCount { get; set; }

    /// <summary>
    /// Estimated session duration in minutes.
    /// Currently null — a reliable heuristic requires product-defined set-duration
    /// assumptions that haven't been finalised. Will be added as an additive change.
    /// </summary>
    public int? EstimatedDurationMinutes { get; set; }

    /// <summary>
    /// Sections in this session, ordered by their Order field.
    /// Schema-on-read: legacy documents with only flat exercises are backfilled into a single
    /// "Hlavní" section before this response is built.
    /// </summary>
    public List<SectionDto> Sections { get; set; } = [];

    /// <summary>
    /// Flat list of all exercises across all sections, in section order.
    /// Kept for backward-compatibility with callers that don't yet read Sections.
    /// </summary>
    public List<ExerciseDto> Exercises { get; set; } = [];

    /// <summary>
    /// Current lock state of this session.
    /// Possible values: "Stable" (no active lock), "Editing" (trainer holds an editing lock),
    /// "Live" (client has an in-progress workout lock).
    /// Populated via a batch <c>GetStateAsync</c> call on the session lock service.
    /// </summary>
    public string LockState { get; set; } = "Stable";

    /// <summary>
    /// Who currently holds the lock, if any.
    /// Possible values: "Coach", "Client", or null when the session is Stable.
    /// </summary>
    public string? LockHolder { get; set; }
}

/// <summary>
/// An ordered section within a session (e.g. "Hlavní", "Warm-up", "Cool-down").
/// </summary>
public class SectionDto
{
    /// <summary>Stable identifier for this section.</summary>
    public Guid SectionId { get; set; }

    /// <summary>Display order within the session (0-based).</summary>
    public int Order { get; set; }

    /// <summary>Display name (e.g. "Hlavní", "Warm-up").</summary>
    public string Name { get; set; } = "";

    /// <summary>
    /// Workout format for this section (e.g. "Emom", "Amrap", "Tabata", "ForTime").
    /// Null means the section uses the default Standard format.
    /// </summary>
    public string? Format { get; set; }

    /// <summary>
    /// Full format-configuration object for the section (rounds, intervals, work/rest timings).
    /// Null when Format is null or Standard.
    /// Mirrors <see cref="FitnessPlatform.Application.Domain.Documents.WodConfig"/> on TrainingSection.
    /// </summary>
    public WodConfig? FormatConfig { get; set; }

    /// <summary>
    /// Optional coach note for this section.
    /// Mirrors the Notes property on TrainingSection.
    /// </summary>
    public string? Notes { get; set; }

    /// <summary>True when this section is considered complete:
    /// for sections with exercises → every exercise has IsCompleted=true;
    /// for sections without exercises → the section's id is in the
    /// TrainingCompletion.CompletedSectionIds set for the owning session.</summary>
    public bool IsCompleted { get; set; }

    /// <summary>Exercises within this section.</summary>
    public List<ExerciseDto> Exercises { get; set; } = [];
}

/// <summary>
/// An exercise within a session, enriched with muscle groups and completion state.
/// </summary>
public class ExerciseDto
{
    /// <summary>Reference to the exercise document's ExternalId.</summary>
    public Guid ExerciseExternalId { get; set; }

    /// <summary>Snapshot exercise name.</summary>
    public string ExerciseName { get; set; } = "";

    /// <summary>Display order within the session.</summary>
    public int Order { get; set; }

    /// <summary>Optional coach notes for this exercise.</summary>
    public string? Notes { get; set; }

    /// <summary>Rest time between sets in seconds.</summary>
    public int? RestSeconds { get; set; }

    /// <summary>
    /// Movement type — drives which set field the prescription uses
    /// (reps / duration / distance / reps-for-time). Required for the
    /// client to render the correct summary string. Serialised as the
    /// enum's string name (e.g. "Reps", "Time", "Distance",
    /// "RepsForTime"); the client casts to its `MovementType` enum.
    /// Defaults to "Reps" when the underlying exercise carries no
    /// explicit value.
    /// </summary>
    public string MovementType { get; set; } = "Reps";

    /// <summary>
    /// Target muscle groups fetched from the Exercise document.
    /// Empty list when the exercise no longer exists in the database.
    /// </summary>
    public List<MuscleGroup> MuscleGroups { get; set; } = [];

    /// <summary>True when every planned set has a completed workout log entry.</summary>
    public bool IsCompleted { get; set; }

    /// <summary>Planned sets with per-set completion timestamps.</summary>
    public List<SetDto> Sets { get; set; } = [];
}

/// <summary>
/// A planned set with its completion state derived from workout logs.
/// </summary>
public class SetDto
{
    /// <summary>1-based set number within the exercise.</summary>
    public int SetNumber { get; set; }

    /// <summary>Set type (Normal, Warmup, Dropset, Superset).</summary>
    public string Type { get; set; } = "";

    /// <summary>Target number of repetitions.</summary>
    public int? Reps { get; set; }

    /// <summary>Target weight in kilograms.</summary>
    public decimal? WeightKg { get; set; }

    /// <summary>Target duration in seconds (for timed exercises).</summary>
    public int? DurationSeconds { get; set; }

    /// <summary>Target distance in meters (for distance-based exercises).</summary>
    public decimal? DistanceMeters { get; set; }

    /// <summary>Rest time after this set in seconds.</summary>
    public int? RestSeconds { get; set; }

    /// <summary>When this set was completed, or null if not yet done.</summary>
    public DateTime? CompletedAt { get; set; }
}
