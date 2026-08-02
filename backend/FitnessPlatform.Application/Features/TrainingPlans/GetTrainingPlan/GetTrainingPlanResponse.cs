using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.WorkoutLogs.Shared;

namespace FitnessPlatform.Application.Features.TrainingPlans.GetTrainingPlan;

/// <summary>
/// Per-section finished state for a training session.
/// A section is "finished" when the client has completed it via either the WorkoutLog path
/// (session-level completion) or the TrainingCompletion path (home-checkbox / section-complete).
/// </summary>
public class SectionFinishedStateDto
{
    /// <summary>
    /// The <see cref="TrainingWorkout.SectionId"/> this finished state belongs to.
    /// </summary>
    public Guid SectionId { get; set; }

    /// <summary>
    /// Whether this section is finished.
    /// True when a completed WorkoutLog exists for the session (all sections done),
    /// or when the TrainingCompletion document shows this section as complete.
    /// </summary>
    public bool IsFinished { get; set; }
}

/// <summary>
/// Per-session edit-lock state projected into the trainer read model.
/// A session with no active lock document reports <c>Stable</c> with a null holder.
/// </summary>
public class SessionLockStateDto
{
    /// <summary>
    /// The <see cref="TrainingSession.SessionId"/> this lock state belongs to.
    /// </summary>
    public Guid SessionId { get; set; }

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
/// Per-set execution data returned by the trainer endpoint.
/// Lets the web layer derive completed / skipped / not-yet-reached states
/// without storing those as flags on the document.
/// </summary>
/// <remarks>
/// Disambiguation rule (derived, never stored):
/// <list type="bullet">
///   <item><description>
///     <b>completed</b> — set number is present in <see cref="CompletedSetsByExercise"/> (meaning
///     the corresponding <see cref="WorkoutSet.CompletedAt"/> was non-null in the <see cref="WorkoutLog"/>).
///   </description></item>
///   <item><description>
///     <b>skipped</b> — set number is absent <em>and</em> <see cref="IsSessionFinished"/> is <c>true</c>.
///   </description></item>
///   <item><description>
///     <b>not-yet-reached</b> — set number is absent <em>and</em> <see cref="IsSessionFinished"/> is <c>false</c>
///     (or there is no <see cref="SessionExecutionDto"/> row for this session at all).
///   </description></item>
/// </list>
/// </remarks>
public class SessionExecutionDto
{
    /// <summary>
    /// The <see cref="TrainingSession.SessionId"/> this execution belongs to.
    /// </summary>
    public Guid SessionId { get; set; }

    /// <summary>
    /// Whether the workout was finalised by the client (<see cref="WorkoutLog.IsCompleted"/> was true).
    /// </summary>
    public bool IsSessionFinished { get; set; }

    /// <summary>
    /// Per-exercise map of which set numbers were completed (i.e. had a non-null
    /// <see cref="WorkoutSet.CompletedAt"/>). Key = ExerciseExternalId; value = sorted list
    /// of 1-based set numbers that were stamped as complete in the <see cref="WorkoutLog"/>.
    /// An absent key means no sets for that exercise were logged.
    /// An empty list should not occur but is treated identically to an absent key.
    /// <para>
    /// <b>Deprecated in favour of <see cref="CompletedSetsBySectionAndExercise"/>.</b>
    /// Retained for backward compatibility. When a multi-section log has the same exercise
    /// in two sections, only the last-encountered section's data appears here — use the
    /// section-aware map for reliable results.
    /// </para>
    /// </summary>
    public Dictionary<Guid, List<int>> CompletedSetsByExercise { get; set; } = new();

    /// <summary>
    /// Section-aware completed sets map. Key = (SectionId, ExerciseExternalId) encoded as
    /// the string <c>"{sectionId}:{exerciseId}"</c>; value = sorted list of completed set numbers.
    /// Use this in preference to <see cref="CompletedSetsByExercise"/> when section context
    /// is available (i.e. when the plan has multi-section sessions).
    /// </summary>
    public Dictionary<string, List<int>> CompletedSetsBySectionAndExercise { get; set; } = new();

    /// <summary>
    /// Per-exercise map of per-set actual values, snapshot-planned values, and isModified flags.
    /// Key = ExerciseExternalId; value = list of <see cref="LoggedSetDto"/> (one per logged set).
    /// An absent key means no sets for that exercise were logged.
    /// The web layer uses this together with <see cref="CompletedSetsByExercise"/> to render
    /// the actual-vs-planned comparison and the upraveno (modified) indicator per set.
    /// <para>
    /// <b>Deprecated in favour of <see cref="LoggedSetsBySectionAndExercise"/>.</b>
    /// Retained for backward compatibility. When a multi-section log has the same exercise
    /// in two sections, only the last-encountered section's data appears here.
    /// </para>
    /// </summary>
    public Dictionary<Guid, List<LoggedSetDto>> LoggedSetsByExercise { get; set; } = new();

    /// <summary>
    /// Section-aware logged sets map. Key = (SectionId, ExerciseExternalId) encoded as
    /// the string <c>"{sectionId}:{exerciseId}"</c>; value = list of <see cref="LoggedSetDto"/>.
    /// Use this in preference to <see cref="LoggedSetsByExercise"/> for multi-section sessions.
    /// </summary>
    public Dictionary<string, List<LoggedSetDto>> LoggedSetsBySectionAndExercise { get; set; } = new();

    /// <summary>
    /// True when at least one set in any exercise under this session has IsModified == true.
    /// The web layer uses this to show the upraveno badge at the session-header level.
    /// Always false when the session has no WorkoutLog (or all logs are legacy without snapshots).
    /// </summary>
    public bool HasModifications { get; set; }

    /// <summary>
    /// Per-section finished state for all sections in this session.
    /// Populated by the endpoint from both WorkoutLog and TrainingCompletion signals.
    /// A section is finished when <see cref="IsSessionFinished"/> is true (session-level completion
    /// implies every section is done), OR when the TrainingCompletion document records that specific
    /// section as complete.
    /// Empty for sessions with no completion data.
    /// The web layer uses this to render the finished label and disable editing on completed sections
    /// independently of the session-level finished state.
    /// </summary>
    public List<SectionFinishedStateDto> FinishedSections { get; set; } = [];
}

/// <summary>
/// Per-(date, sessionId) completion record for the plan's client.
/// One entry per (clientId, date, sessionId) tuple. Surfaces which
/// exercises have already been marked complete so the trainer editor
/// can lock the corresponding fields.
/// </summary>
public class TrainingPlanCompletionDto
{
    public DateOnly Date { get; set; }
    public Guid SessionId { get; set; }

    /// <summary>
    /// Flat list of completed exercise external IDs for this session on this date.
    /// <para>
    /// <b>Deprecated.</b> Use <see cref="CompletedExerciseIdsBySection"/> for section-aware tracking.
    /// Retained for backward compatibility.
    /// </para>
    /// </summary>
    public List<Guid> CompletedExerciseIds { get; set; } = [];

    /// <summary>
    /// Section-aware completed exercise IDs. Key = SectionId, value = list of completed
    /// ExerciseExternalIds within that section. Populated via read-time backfill so legacy
    /// completion documents are transparently migrated.
    /// </summary>
    public Dictionary<Guid, List<Guid>> CompletedExerciseIdsBySection { get; set; } = new();

    public List<Guid> CompletedSectionIds { get; set; } = [];
    public int Version { get; set; }
}

/// <summary>
/// Detailed training plan response including all weeks, sessions, exercises, and sets.
/// </summary>
public class GetTrainingPlanResponse
{
    /// <summary>
    /// Plan's public identifier.
    /// </summary>
    public Guid PlanId { get; set; }

    /// <summary>
    /// The client's <c>ClientProfile.PublicId</c> — the client-facing identifier consumed by
    /// web/mobile to build routes like <c>/trainer/clients/{{clientId}}/...</c>. NOT the
    /// internal Mongo storage key (<c>ApplicationUser.Id</c> since #840) — see
    /// <see cref="FromDocument"/>.
    /// </summary>
    public Guid ClientId { get; set; }

    /// <summary>
    /// Trainer's public user identifier.
    /// </summary>
    public Guid TrainerId { get; set; }

    /// <summary>
    /// Display name of the plan.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Optional plan description.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Current plan status as string (Draft, Active, Archived).
    /// </summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// All weeks in the plan with their sessions, exercises, and sets.
    /// </summary>
    public List<TrainingWeek> Weeks { get; set; } = [];

    /// <summary>
    /// Optimistic concurrency version.
    /// </summary>
    public int Version { get; set; }

    /// <summary>
    /// When the plan was created.
    /// </summary>
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// When the plan was last updated.
    /// </summary>
    public DateTime? DateUpdated { get; set; }

    /// <summary>
    /// The Monday when Week 1 begins, if set.
    /// </summary>
    public DateTime? StartDate { get; set; }

    /// <summary>
    /// When this plan was marked as completed, if applicable.
    /// </summary>
    public DateTime? DateCompleted { get; set; }

    /// <summary>
    /// Linked questionnaire response (cross-DB reference to PostgreSQL QuestionnaireResponse.PublicId).
    /// Null if no questionnaire is linked to this plan.
    /// </summary>
    public Guid? QuestionnaireResponseId { get; set; }

    /// <summary>
    /// All completion records for the plan's client, sorted by (Date asc, SessionId asc).
    /// Populated by the endpoint after loading the plan; the client side should filter
    /// to dates that fall within the plan's active weeks.
    /// </summary>
    public List<TrainingPlanCompletionDto> Completions { get; set; } = [];

    /// <summary>
    /// Per-session workout-log execution data for the plan's client.
    /// One entry per session that has at least one <see cref="WorkoutLog"/> record.
    /// Sessions with no log entry are absent (equivalent to all sets being not-yet-reached).
    /// The web layer uses this together with <see cref="Completions"/> to render per-set,
    /// per-exercise, and per-session completed/skipped/unreached state indicators.
    /// </summary>
    public List<SessionExecutionDto> SessionExecutions { get; set; } = [];

    /// <summary>
    /// Per-session edit-lock state for all sessions in the plan.
    /// Only sessions with an active (non-expired) lock appear here; a session absent from
    /// this list is implicitly <c>Stable</c>.
    /// The web editor uses this on initial load to show the Live in-progress badge and gate
    /// the unlock affordance — SignalR events update this state while the page is open.
    /// </summary>
    public List<SessionLockStateDto> SessionLockStates { get; set; } = [];

    /// <summary>
    /// Maps a <see cref="TrainingPlan"/> document to a detailed response DTO.
    /// </summary>
    /// <param name="plan">The training plan document.</param>
    /// <param name="clientPublicId">
    /// The client's <c>ClientProfile.PublicId</c> to expose as <see cref="ClientId"/> —
    /// NOT <paramref name="plan"/>.ClientId directly, which is the internal
    /// <c>ApplicationUser.Id</c> storage key since #840. Callers resolve this via
    /// <see cref="FitnessPlatform.Application.Domain.Extensions.ClientProfileLookupExtensions.ResolveClientPublicIdAsync"/>
    /// (or the batch variant for list endpoints) before calling this factory.
    /// </param>
    public static GetTrainingPlanResponse FromDocument(TrainingPlan plan, Guid clientPublicId)
    {
        return new GetTrainingPlanResponse
        {
            PlanId = plan.ExternalId,
            ClientId = clientPublicId,
            TrainerId = plan.TrainerId,
            Name = plan.Name,
            Description = plan.Description,
            Status = plan.Status.ToString(),
            Weeks = plan.Weeks,
            Version = plan.Version,
            DateCreated = plan.DateCreated,
            DateUpdated = plan.DateUpdated,
            StartDate = plan.StartDate,
            DateCompleted = plan.DateCompleted,
            QuestionnaireResponseId = plan.QuestionnaireResponseId
        };
    }
}
