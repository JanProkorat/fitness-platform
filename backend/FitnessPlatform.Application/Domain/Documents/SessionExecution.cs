using FitnessPlatform.Application.Domain.Enums;
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Application.Domain.Documents;

/// <summary>
/// MongoDB root aggregate unifying the former <c>WorkoutLog</c> and <c>TrainingCompletion</c>
/// documents (#841) into a single per-(client, session, date) record of "what happened in this
/// training session on this day" — both the lightweight completion flags (Today-card checkboxes)
/// and the optional detailed set-by-set <see cref="SessionExecutionPerformance"/> (live training
/// assistant / trainer-driven retroactive finish).
/// </summary>
/// <remarks>
/// <para>
/// <b>Identity.</b> <see cref="ClientId"/> is always <c>ApplicationUser.Id</c> (matches both
/// legacy source documents post-#840). <see cref="PlanId"/>/<see cref="SessionId"/> are null for
/// ad-hoc (unplanned) workouts — those are exempt from the uniqueness constraint below.
/// </para>
/// <para>
/// <b>Uniqueness.</b> A partial-unique index on (<see cref="ClientId"/>, <see cref="SessionId"/>,
/// <see cref="Date"/>) — filtered to documents where both fields exist — enforces exactly ONE
/// execution per planned session per calendar day, regardless of whether it originated from a
/// checkbox toggle or a live workout. See <c>MongoIndexInitializer.CreateSessionExecutionIndexes</c>.
/// </para>
/// <para>
/// <b>Status.</b> <see cref="SessionExecutionStatus.Completed"/> means the session is fully done —
/// either <see cref="Performance"/>.CompletedAt is set (a finished live workout), or every
/// exercise/section in the plan's session definition is present in the completion flags below
/// (see <c>SessionExecutionExtensions.IsSessionComplete</c>). Otherwise
/// <see cref="SessionExecutionStatus.Partial"/>.
/// </para>
/// </remarks>
public class SessionExecution
{
    /// <summary>
    /// MongoDB internal identifier.
    /// </summary>
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public ObjectId Id { get; set; }

    /// <summary>
    /// Public-facing identifier used in API requests and responses.
    /// </summary>
    /// <remarks>
    /// Every execution now gets a freshly-generated Guid. The migration that used to carry a
    /// source <c>WorkoutLog.ExternalId</c> over into this field — so that
    /// <c>PersonalRecord.WorkoutLogId</c> kept resolving without a PersonalRecord data
    /// migration — was deleted in #848, so no document is produced that way any more.
    /// </remarks>
    [BsonElement("externalId")]
    public Guid ExternalId { get; set; }

    /// <summary>
    /// The client this execution belongs to (matches ApplicationUser.Id).
    /// </summary>
    [BsonElement("clientId")]
    public Guid ClientId { get; set; }

    /// <summary>
    /// Reference to the training plan's ExternalId. Null for ad-hoc (unplanned) workouts.
    /// </summary>
    [BsonElement("planId")]
    [BsonIgnoreIfNull]
    public Guid? PlanId { get; set; }

    /// <summary>
    /// Reference to the TrainingSession's SessionId within the plan. Null for ad-hoc workouts.
    /// </summary>
    [BsonElement("sessionId")]
    [BsonIgnoreIfNull]
    public Guid? SessionId { get; set; }

    /// <summary>
    /// The calendar day (midnight UTC) this execution applies to. Derived via
    /// <see cref="ToCompletionDateUtc(DateTime, TimeZoneInfo)"/> from the workout's start/completion
    /// instant (live path) or supplied directly (checkbox path).
    /// </summary>
    [BsonElement("date")]
    public DateTime Date { get; set; }

    /// <summary>
    /// Lifecycle status — see remarks on <see cref="SessionExecution"/>.
    /// </summary>
    [BsonElement("status")]
    [BsonRepresentation(BsonType.String)]
    public SessionExecutionStatus Status { get; set; } = SessionExecutionStatus.Partial;

    /// <summary>
    /// Flat list of completed <see cref="SessionExercise.ExerciseId"/> instance values for this
    /// session on this date — both standalone exercises and exercises nested inside a workout.
    /// <para>
    /// Replaces the pre-#857-phase-3b <c>completedExerciseIdsBySection</c> dictionary (keyed by
    /// <see cref="TrainingWorkout.WorkoutId"/>, valued with catalog
    /// <see cref="SessionExercise.ExerciseExternalId"/>s), which could not distinguish two
    /// occurrences of the same catalog exercise within one workout or between a standalone
    /// occurrence and a nested one. <see cref="SessionExercise.ExerciseId"/> already disambiguates
    /// every instance, so no per-workout grouping is needed any more — a flat set membership check
    /// (<c>CompletedExerciseInstanceIds.Contains(exercise.ExerciseId)</c>) is sufficient and correct.
    /// </para>
    /// </summary>
    [BsonElement("completedExerciseInstanceIds")]
    public List<Guid> CompletedExerciseInstanceIds { get; set; } = [];

    /// <summary>
    /// Workout IDs (matching <see cref="TrainingWorkout.WorkoutId"/>) that the client has marked
    /// complete on this date. Used for workouts that don't track at the exercise level.
    /// </summary>
    [BsonElement("completedWorkoutIds")]
    [BsonIgnoreIfNull]
    public List<Guid>? CompletedWorkoutIds { get; set; }

    /// <summary>
    /// Optional per-set completion data, keyed by <see cref="SessionExercise.ExerciseExternalId"/>
    /// (serialized as a lowercase Guid string) — deliberately <b>NOT</b> rekeyed onto the
    /// per-instance <see cref="SessionExercise.ExerciseId"/> the way
    /// <see cref="CompletedExerciseInstanceIds"/> and <see cref="CompletedWorkoutIds"/> are.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>No writer since #848 — see #1007.</b> The only site that ever populated this field was
    /// <c>MongoIndexInitializer.ApplyCompletionFlags</c>, which copied it verbatim from
    /// <see cref="TrainingCompletion.CompletedSets"/> during the one-shot migration deleted in
    /// #848. Nothing writes it now, so it is always empty and the read branch in
    /// <c>GetFullTrainingPlanEndpoint</c> never fires.
    /// </para>
    /// <para>
    /// <b>Known divergence (#857 finding 2), retained for context.</b> That copy was catalog-keyed:
    /// resolving a catalog id to the correct per-instance <see cref="SessionExercise.ExerciseId"/>
    /// needs the parent plan's session definition, which <c>ApplyCompletionFlags</c> did not have.
    /// The reader in <c>GetFullTrainingPlanEndpoint</c> is therefore written to look the key up
    /// against a lookup keyed by <see cref="SessionExercise.ExerciseExternalId"/>, not
    /// <see cref="SessionExercise.ExerciseId"/>.
    /// </para>
    /// <para>
    /// This means two placements of the same catalog exercise within one session (standalone AND
    /// nested, or nested twice) share set-completion state under this field — the exact ambiguity
    /// the per-instance id exists to remove elsewhere. In practice this is a latent gap rather
    /// than an active bug: <see cref="TrainingCompletion"/> is frozen/read-only with no live write
    /// path (see its class remarks), so no current endpoint ever populates this dictionary for a
    /// standalone-plus-nested session. If set-level completion tracking is revived on a live write
    /// path, that path must key on <see cref="SessionExercise.ExerciseId"/> directly (bypassing
    /// this legacy field/migration entirely) rather than perpetuating the catalog-id keying here.
    /// </para>
    /// </remarks>
    [BsonElement("completedSets")]
    [BsonIgnoreIfNull]
    public Dictionary<string, List<int>>? CompletedSets { get; set; }

    /// <summary>
    /// Optional detailed set-by-set performance data. Present only when the client ran the
    /// live-training-assistant flow, or a trainer retroactively finished the session.
    /// Null for executions created purely via the lightweight Today-card checkboxes.
    /// </summary>
    [BsonElement("performance")]
    [BsonIgnoreIfNull]
    public SessionExecutionPerformance? Performance { get; set; }

    /// <summary>
    /// When this document was created.
    /// </summary>
    [BsonElement("dateCreated")]
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// When this document was last updated.
    /// </summary>
    [BsonElement("dateUpdated")]
    [BsonIgnoreIfNull]
    public DateTime? DateUpdated { get; set; }

    /// <summary>
    /// Optimistic concurrency version. Incremented on each update.
    /// </summary>
    [BsonElement("version")]
    public int Version { get; set; } = 1;

    /// <summary>
    /// Flat view of all exercises across all Performance sections. Read-only convenience
    /// accessor mirroring the retired <c>WorkoutLog.Exercises</c> property. Empty when
    /// <see cref="Performance"/> is null.
    /// </summary>
    [BsonIgnore]
    public IReadOnlyList<WorkoutExercise> Exercises =>
        Performance?.Exercises ?? [];

    /// <summary>
    /// Converts a UTC instant to the midnight-UTC calendar-day value used as <see cref="Date"/>.
    /// Single authoritative expression — mirrors the retired <c>WorkoutLog.ToCompletionDateUtc</c>
    /// so historical data derived from it agrees on the calendar day for backdated finishes.
    /// </summary>
    /// <remarks>
    /// This overload anchors the calendar day on the UTC calendar — it is the correct choice only
    /// for call sites that have deliberately not yet adopted per-client local-day resolution (see
    /// <c>Seed/QaSeedRunner.cs</c>). New production call sites should use the
    /// <see cref="ToCompletionDateUtc(DateTime, TimeZoneInfo)"/> overload, which resolves the
    /// calendar day from the CLIENT's local time zone (#935) — see
    /// <see cref="Services.ClientLocalDateResolver"/>.
    /// </remarks>
    /// <param name="instantUtc">The UTC instant to convert.</param>
    /// <returns>The corresponding midnight UTC <see cref="DateTime"/>.</returns>
    public static DateTime ToCompletionDateUtc(DateTime instantUtc) =>
        DateOnly.FromDateTime(instantUtc).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

    /// <summary>
    /// Converts a UTC instant to the midnight-UTC value of the CLIENT's LOCAL calendar day used
    /// as <see cref="Date"/> (#935). Delegates to
    /// <see cref="Services.ClientLocalDateResolver.ResolveLocalDateUtcMidnight"/> — this overload
    /// exists on <see cref="SessionExecution"/> itself so every production call site keeps using
    /// the same authoritative expression named on this type.
    /// </summary>
    /// <param name="instantUtc">The UTC instant to convert.</param>
    /// <param name="clientTimeZone">The client's resolved time zone (see
    /// <see cref="Extensions.ClientLocalTimeExtensions.ResolveClientTimeZoneAsync"/>).</param>
    /// <returns>The corresponding midnight UTC <see cref="DateTime"/> for the client's local day.</returns>
    public static DateTime ToCompletionDateUtc(DateTime instantUtc, TimeZoneInfo clientTimeZone) =>
        Services.ClientLocalDateResolver.ResolveLocalDateUtcMidnight(instantUtc, clientTimeZone);
}
