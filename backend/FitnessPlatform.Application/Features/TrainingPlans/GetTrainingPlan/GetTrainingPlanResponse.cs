using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.TrainingPlans.GetTrainingPlan;

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
    /// Maps a <see cref="TrainingPlan"/> document to a detailed response DTO.
    /// </summary>
    public static GetTrainingPlanResponse FromDocument(TrainingPlan plan) => new()
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
