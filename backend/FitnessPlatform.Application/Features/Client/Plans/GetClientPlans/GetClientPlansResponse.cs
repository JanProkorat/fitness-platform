namespace FitnessPlatform.Application.Features.Client.Plans.GetClientPlans;

/// <summary>
/// Response containing the client's plans.
/// </summary>
public class GetClientPlansResponse
{
    /// <summary>Plan summaries.</summary>
    public List<ClientPlanItem> Items { get; set; } = [];
}

/// <summary>
/// Lightweight plan summary for the client's plan list.
/// </summary>
public class ClientPlanItem
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
}
