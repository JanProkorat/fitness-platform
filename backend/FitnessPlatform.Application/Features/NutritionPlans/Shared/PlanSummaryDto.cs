using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.NutritionPlans.Shared;

/// <summary>
/// Lightweight plan summary for list views.
/// </summary>
public class PlanSummaryDto
{
    /// <summary>
    /// Plan's public identifier.
    /// </summary>
    public Guid PlanId { get; set; }

    /// <summary>
    /// Display name.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Client's user ID.
    /// </summary>
    public Guid ClientId { get; set; }

    /// <summary>
    /// Current status as string (Draft, Active, Archived).
    /// </summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// Number of weeks.
    /// </summary>
    public int WeekCount { get; set; }

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
    /// Linked questionnaire response ID, if any.
    /// </summary>
    public Guid? QuestionnaireResponseId { get; set; }

    /// <summary>
    /// Maps a <see cref="NutritionPlan"/> document to a summary DTO.
    /// </summary>
    public static PlanSummaryDto FromDocument(NutritionPlan plan) => new()
    {
        PlanId = plan.ExternalId,
        Name = plan.Name,
        ClientId = plan.ClientId,
        Status = plan.Status.ToString(),
        WeekCount = plan.Weeks.Count,
        Version = plan.Version,
        DateCreated = plan.DateCreated,
        DateUpdated = plan.DateUpdated,
        StartDate = plan.StartDate,
        DateCompleted = plan.DateCompleted,
        QuestionnaireResponseId = plan.QuestionnaireResponseId
    };
}
