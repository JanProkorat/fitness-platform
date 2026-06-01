using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.ClientTraining.GetTodaySession;

/// <summary>
/// Response with today's planned training session(s).
/// </summary>
public class GetTodaySessionResponse
{
    /// <summary>Whether there is at least one session planned for today.</summary>
    public bool HasSession { get; set; }

    /// <summary>The training plan's public ID.</summary>
    public Guid? PlanId { get; set; }

    /// <summary>The plan name.</summary>
    public string? PlanName { get; set; }

    /// <summary>
    /// All training sessions scheduled for today, ordered by Order.
    /// Empty when there are none.
    /// </summary>
    public List<TrainingSession> Sessions { get; set; } = [];

    /// <summary>
    /// The first training session for today, if any.
    /// <para>
    /// Deprecated: use <see cref="Sessions"/> instead. This property mirrors
    /// <c>Sessions[0]</c> (or <c>null</c> when empty) and is kept for backwards
    /// compatibility with consumers that still reference the singular session.
    /// </para>
    /// </summary>
    [Obsolete("Use Sessions instead. This property is retained for backwards compatibility and will be removed in a future release.")]
    public TrainingSession? Session { get; set; }

    /// <summary>Current week number in the plan cycle.</summary>
    public int? CurrentWeek { get; set; }

    /// <summary>Total number of weeks in the plan.</summary>
    public int? TotalWeeks { get; set; }

    /// <summary>Plan status (Active, Completed, Archived).</summary>
    public string? Status { get; set; }

    /// <summary>Linked questionnaire response public ID, if any.</summary>
    public Guid? QuestionnaireResponseId { get; set; }

    /// <summary>When this plan was marked as completed, if applicable.</summary>
    public DateTime? DateCompleted { get; set; }

    /// <summary>
    /// Per-exercise muscle groups, keyed by SessionExercise.ExerciseExternalId.
    /// Empty when an exercise no longer exists in the database. Populated by
    /// looking up Exercise documents for every exercise referenced by today's
    /// sessions.
    /// </summary>
    public Dictionary<Guid, List<MuscleGroup>> ExerciseMuscleGroups { get; set; } = new();

    /// <summary>
    /// Per-session completed exercise IDs, keyed by SessionId. Sourced from
    /// TrainingCompletion documents for today. Empty dictionary when no session
    /// has any completed exercise for today (or when no active plan exists).
    /// <para>
    /// <b>Deprecated.</b> Use <see cref="CompletedExerciseIdsBySectionAndSession"/> for
    /// section-aware completion tracking. This field is retained for backward compatibility
    /// with mobile and web clients that have not yet migrated to the new field.
    /// </para>
    /// </summary>
    public Dictionary<Guid, List<Guid>> CompletedExerciseIdsBySession { get; set; } = new();

    /// <summary>
    /// Section-aware completed exercise IDs for today.
    /// Outer key = SessionId, inner key = SectionId, value = list of completed ExerciseExternalIds
    /// within that section.
    /// Sourced from TrainingCompletion documents with read-time backfill for legacy data.
    /// Empty dictionary when no exercises have been completed for today.
    /// </summary>
    public Dictionary<Guid, Dictionary<Guid, List<Guid>>> CompletedExerciseIdsBySectionAndSession { get; set; } = new();

    /// <summary>
    /// Per-session completed section IDs, keyed by SessionId. Sourced from
    /// TrainingCompletion documents for today. Empty dictionary when no
    /// section has been section-completed for today (or no active plan exists).
    /// Sections appear here when the client tapped a section-level checkbox
    /// (e.g. on a ForTime "Running" workout that has no exercises) or when
    /// MarkSessionComplete fanned out section IDs.
    /// </summary>
    public Dictionary<Guid, List<Guid>> CompletedSectionIdsBySession { get; set; } = new();

    /// <summary>
    /// Per-session optimistic-concurrency version numbers for today, keyed by SessionId.
    /// Matches the Version on the TrainingCompletion document. Used by the client to
    /// send the If-Match-style version header on subsequent mark/unmark requests.
    /// Missing entries imply a fresh document (server will accept Version=null/1).
    /// </summary>
    public Dictionary<Guid, int> VersionBySession { get; set; } = new();

    /// <summary>
    /// Per-session, per-exercise completed set numbers for today. Keyed by
    /// SessionId → ExerciseExternalId → list of 1-based SetNumbers whose
    /// <see cref="WorkoutSet.CompletedAt"/> is non-null in the latest
    /// <see cref="WorkoutLog"/> for that session on today's date.
    /// Empty when no live-training progress has been logged for today.
    /// Keeps per-set state out of the planning-document tree (Sessions) which
    /// represents prescription, not actuals.
    /// </summary>
    public Dictionary<Guid, Dictionary<Guid, List<int>>> CompletedSetsBySessionExercise { get; set; } = new();

    /// <summary>
    /// Per-session lock state, keyed by SessionId.
    /// Possible values: "Stable" (no active lock), "Editing" (trainer holds an editing lock),
    /// "Live" (client has an in-progress workout lock).
    /// Missing entries are treated as "Stable".
    /// Populated via a single batch <c>GetStateAsync</c> call on the session lock service.
    /// </summary>
    public Dictionary<Guid, string> LockStateBySession { get; set; } = new();

    /// <summary>
    /// Per-session lock holder, keyed by SessionId.
    /// Possible values: "Coach" (trainer/nutritionist holds the lock) or "Client".
    /// Null / missing when the session is in the Stable state.
    /// </summary>
    public Dictionary<Guid, string?> LockHolderBySession { get; set; } = new();
}
