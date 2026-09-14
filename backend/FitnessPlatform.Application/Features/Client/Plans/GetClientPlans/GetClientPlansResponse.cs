namespace FitnessPlatform.Application.Features.Client.Plans.GetClientPlans;

/// <summary>
/// Response containing the client's plans.
/// </summary>
public class GetClientPlansResponse
{
    /// <summary>Plan summaries.</summary>
    public List<ClientOwnPlanItem> Items { get; set; } = [];
}

/// <summary>
/// Lightweight plan summary for the client's own plan list. Distinct from
/// the trainer-facing ClientPlanItem in Features/Trainers/ListClientPlans —
/// the two DTOs previously shared a name, which made NSwag's generated
/// client's type-name assignment dependent on document processing order.
/// </summary>
public class ClientOwnPlanItem
{
    /// <summary>Plan public identifier.</summary>
    public Guid PlanId { get; set; }

    /// <summary>Display name.</summary>
    public string PlanName { get; set; } = string.Empty;

    /// <summary>"nutrition" or "training".</summary>
    public string Type { get; set; } = string.Empty;

    /// <summary>Plan status as string (Active, Completed, Archived).</summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>The Monday when Week 1 begins, if set.</summary>
    public DateTime? StartDate { get; set; }

    /// <summary>Total number of weeks in the plan.</summary>
    public int TotalWeeks { get; set; }

    /// <summary>Number of published weeks.</summary>
    public int PublishedWeekCount { get; set; }

    /// <summary>When this plan was marked as completed.</summary>
    public DateTime? DateCompleted { get; set; }

    /// <summary>Linked questionnaire response ID, if any.</summary>
    public Guid? QuestionnaireResponseId { get; set; }

    /// <summary>
    /// The current week number within this plan, or null if the plan hasn't started yet.
    /// Computed from StartDate (preferred) or the first published week's DatePublished.
    /// </summary>
    public int? CurrentWeek { get; set; }

    /// <summary>
    /// Target daily kilocalories from the plan's GlobalSettings. Populated for nutrition plans only.
    /// </summary>
    public decimal? DailyKcal { get; set; }

    /// <summary>
    /// Whether today's day-of-week has a session in the current week. Populated for training plans only.
    /// Null when CurrentWeek is null or for nutrition plans.
    /// </summary>
    public bool? HasTodaySession { get; set; }
}
