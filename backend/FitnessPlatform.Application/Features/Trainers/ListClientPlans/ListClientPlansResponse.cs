namespace FitnessPlatform.Application.Features.Trainers.ListClientPlans;

/// <summary>
/// Combined list of a client's nutrition and training plans returned by
/// GET /trainer/clients/{clientId}/plans.
/// </summary>
public class ListClientPlansResponse
{
    /// <summary>
    /// All plans (nutrition + training) across all statuses, newest first.
    /// </summary>
    public List<ClientPlanItem> Plans { get; set; } = [];
}

/// <summary>
/// A single plan entry in the combined list.
/// </summary>
public class ClientPlanItem
{
    /// <summary>
    /// The plan's public ExternalId (Guid) as stored in MongoDB.
    /// </summary>
    public Guid PlanId { get; set; }

    /// <summary>
    /// Discriminates the plan type: "Nutrition" or "Training".
    /// </summary>
    public string PlanType { get; set; } = string.Empty;

    /// <summary>
    /// Display name of the plan.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// The Monday when Week 1 begins (UTC). Null for plans where StartDate has not been set.
    /// </summary>
    public DateTime? PeriodStart { get; set; }

    /// <summary>
    /// When the plan was marked completed (UTC). Null for active/draft plans and open-ended plans.
    /// </summary>
    public DateTime? PeriodEnd { get; set; }

    /// <summary>
    /// Current plan status as a string: "Draft", "Active", "Completed", "Archived".
    /// </summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>
    /// Per-plan result summary. Null fields indicate the metric is not applicable
    /// (e.g. compliance is null for training plans; totalTrainings is null for nutrition plans).
    /// </summary>
    public ClientPlanResultSummary ResultSummary { get; set; } = new();
}

/// <summary>
/// Per-plan result summary. Fields not applicable to the plan type are null.
/// </summary>
public class ClientPlanResultSummary
{
    // ── Training-plan fields ──────────────────────────────────────────────

    /// <summary>
    /// Count of WorkoutLogs where PlanId == plan.ExternalId and IsCompleted == true.
    /// Null for nutrition plans.
    /// </summary>
    public int? TotalTrainings { get; set; }

    /// <summary>
    /// Count of PersonalRecords with AchievedAt in [plan.StartDate .. plan.DateCompleted ?? now].
    /// Null for nutrition plans or plans without a StartDate.
    /// </summary>
    public int? PrCount { get; set; }

    // ── Nutrition-plan fields ─────────────────────────────────────────────

    /// <summary>
    /// Nutrition compliance % (0-100) over the plan period via IComplianceService.
    /// Null for training plans, or when the plan has no StartDate.
    /// </summary>
    public decimal? CompliancePercent { get; set; }

    /// <summary>
    /// Body weight delta (kg) from the first BodyMeasurement on/after plan start
    /// to the last BodyMeasurement on/before plan end (DateCompleted ?? now).
    /// Positive = weight gained; negative = weight lost.
    /// Null for training plans, or when fewer than two measurements exist in the window.
    /// </summary>
    public decimal? WeightDeltaKg { get; set; }
}
