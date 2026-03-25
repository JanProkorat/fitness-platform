using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.TrainingPlans.Shared;

/// <summary>
/// Lightweight training plan summary for list views.
/// </summary>
public class TrainingPlanSummaryDto
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
    /// Optional plan description.
    /// </summary>
    public string? Description { get; set; }

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
    /// Maps a <see cref="TrainingPlan"/> document to a summary DTO.
    /// </summary>
    public static TrainingPlanSummaryDto FromDocument(TrainingPlan plan) => new()
    {
        PlanId = plan.ExternalId,
        Name = plan.Name,
        Description = plan.Description,
        ClientId = plan.ClientId,
        Status = plan.Status.ToString(),
        WeekCount = plan.Weeks.Count,
        Version = plan.Version,
        DateCreated = plan.DateCreated,
        DateUpdated = plan.DateUpdated,
        StartDate = plan.StartDate
    };
}
