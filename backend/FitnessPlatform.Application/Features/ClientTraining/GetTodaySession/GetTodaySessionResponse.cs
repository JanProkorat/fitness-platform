using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.WorkoutLogs.Shared;

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
    /// <b>Deprecated.</b> Use <see cref="CompletedExerciseIdsByWorkoutAndSession"/> for
    /// workout-aware completion tracking. This field is retained for backward compatibility
    /// with mobile and web clients that have not yet migrated to the new field.
    /// </para>
    /// </summary>
    public Dictionary<Guid, List<Guid>> CompletedExerciseIdsBySession { get; set; } = new();

    /// <summary>
    /// Workout-aware completed exercise IDs for today.
    /// Outer key = SessionId, inner key = WorkoutId, value = list of completed ExerciseExternalIds
    /// within that workout.
    /// Sourced from TrainingCompletion documents with read-time backfill for legacy data.
    /// Empty dictionary when no exercises have been completed for today.
    /// </summary>
    public Dictionary<Guid, Dictionary<Guid, List<Guid>>> CompletedExerciseIdsByWorkoutAndSession { get; set; } = new();

    /// <summary>
    /// Per-session completed workout IDs, keyed by SessionId. Sourced from
    /// TrainingCompletion documents for today. Empty dictionary when no
    /// workout has been workout-completed for today (or no active plan exists).
    /// Workouts appear here when the client tapped a workout-level checkbox
    /// (e.g. on a ForTime "Running" workout that has no exercises) or when
    /// MarkSessionComplete fanned out workout IDs.
    /// </summary>
    public Dictionary<Guid, List<Guid>> CompletedWorkoutIdsBySession { get; set; } = new();

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

    /// <summary>
    /// Per-session photo list for today, keyed by SessionId.
    /// Each value is an ordered list of photos that were saved to the session log for today's date.
    /// Sourced from the <c>SessionLog</c> MongoDB document for today.
    /// Empty dictionary when no photos have been saved for any session today (or when no active plan exists).
    /// </summary>
    public Dictionary<Guid, List<SessionPhotoDto>> PhotosBySession { get; set; } = new();

    /// <summary>
    /// Per-session diary note for today, keyed by SessionId.
    /// Only populated for sessions whose <c>SessionLog</c> has a non-null, non-empty <c>Note</c>.
    /// Allows the mobile client to pre-load the existing note into its textarea so a subsequent
    /// Save does not overwrite it with null (data-loss prevention).
    /// Empty dictionary when no session has a note today (or when no active plan exists).
    /// </summary>
    public Dictionary<Guid, string> NotesBySession { get; set; } = new();

    /// <summary>
    /// Per-session, per-exercise logged set values for today.
    /// Keyed by SessionId → ExerciseExternalId → list of <see cref="LoggedSetDto"/> (one per set).
    /// Carries actual logged values, snapshot-planned values, and the backend-computed isModified flag.
    /// Replaces the set-number-only <see cref="CompletedSetsBySessionExercise"/> for callers that
    /// need actual vs planned comparison.
    /// Empty when no live-training progress has been logged for today.
    /// </summary>
    public Dictionary<Guid, Dictionary<Guid, List<LoggedSetDto>>> LoggedSetsBySessionExercise { get; set; } = new();

    /// <summary>
    /// Per-session hasModifications flag for today, keyed by SessionId.
    /// True when any set under any exercise in the session has IsModified == true in the latest log.
    /// Missing entries are treated as false (no modifications / no log).
    /// </summary>
    public Dictionary<Guid, bool> HasModificationsBySession { get; set; } = new();

    /// <summary>
    /// Per-session completed exercise INSTANCE ids for today, keyed by SessionId. Values are
    /// raw <see cref="SessionExercise.ExerciseId"/> values — unlike
    /// <see cref="CompletedExerciseIdsBySession"/> and
    /// <see cref="CompletedExerciseIdsByWorkoutAndSession"/> (both keyed on the catalog
    /// <see cref="SessionExercise.ExerciseExternalId"/>), this field lets a client address
    /// completion for one specific placement of an exercise when the same catalog exercise
    /// appears twice in one session (standalone AND nested, or nested twice) (#877).
    /// <para>
    /// <b>Union of two sources — read this before consuming the field.</b> The value set is
    /// the union of:
    /// </para>
    /// <list type="number">
    /// <item>Every id in the session's <see cref="SessionExecution.CompletedExerciseInstanceIds"/>,
    /// carried verbatim — these already identify a single placement.</item>
    /// <item><b>Performance-derived completion, fanned out to every sibling instance sharing the
    /// same catalog id.</b> <see cref="WorkoutExercise"/> (the live-training-assistant side of
    /// <see cref="SessionExecution.Performance"/>) carries only <see cref="WorkoutExercise.ExerciseExternalId"/>
    /// — it has NO instance id, so a fully-logged exercise from a live workout cannot be
    /// attributed to one specific placement. Rather than silently omitting it (which would make
    /// this field strictly LESS complete than the catalog-keyed fields it supersedes, and a
    /// session finished through the live-training assistant would render with no ticks at all),
    /// every <see cref="SessionExercise.ExerciseId"/> in the session whose
    /// <see cref="SessionExercise.ExerciseExternalId"/> matches a fully-logged Performance
    /// exercise is added here too. Concretely: if a session holds catalog exercise X both
    /// standalone and nested in a workout, and the client fully logs X via the live-training
    /// assistant, BOTH instance ids appear in this field — the write path cannot distinguish
    /// which placement was actually performed, so both are reported complete rather than
    /// neither.</item>
    /// </list>
    /// <para>
    /// Empty dictionary when no active plan exists or no session has any completed exercise for
    /// today. Additive alongside <see cref="CompletedExerciseIdsBySession"/> and
    /// <see cref="CompletedExerciseIdsByWorkoutAndSession"/>, which keep their existing
    /// catalog-keyed semantics unchanged.
    /// </para>
    /// </summary>
    public Dictionary<Guid, List<Guid>> CompletedExerciseInstanceIdsBySession { get; set; } = new();
}

/// <summary>
/// A photo attached to a session diary entry, as returned in <see cref="GetTodaySessionResponse.PhotosBySession"/>.
/// </summary>
public class SessionPhotoDto
{
    /// <summary>The MinIO blob URL for this photo.</summary>
    public string BlobUrl { get; set; } = string.Empty;

    /// <summary>UTC timestamp when the photo was uploaded/persisted.</summary>
    public DateTime UploadedAt { get; set; }

    /// <summary>Optional per-photo caption (max 500 chars). Null when none was provided.</summary>
    public string? Note { get; set; }
}
