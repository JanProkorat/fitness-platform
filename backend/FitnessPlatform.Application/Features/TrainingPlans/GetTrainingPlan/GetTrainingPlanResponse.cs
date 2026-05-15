using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.TrainingPlans.GetTrainingPlan;

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
    /// Client's public user identifier.
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
    /// Maps a <see cref="TrainingPlan"/> document to a detailed response DTO.
    /// </summary>
    public static GetTrainingPlanResponse FromDocument(TrainingPlan plan)
    {
        // Schema-on-read: materialize legacy flat exercises into a default "Hlavní" section.
        foreach (var week in plan.Weeks)
        {
            foreach (var session in week.Sessions)
            {
                session.WithBackfilledSections();
            }
        }

        return new GetTrainingPlanResponse
        {
            PlanId = plan.ExternalId,
            ClientId = plan.ClientId,
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
