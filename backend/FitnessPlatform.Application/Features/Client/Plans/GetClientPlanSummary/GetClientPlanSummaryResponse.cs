namespace FitnessPlatform.Application.Features.Client.Plans.GetClientPlanSummary;

/// <summary>
/// Progress summary of one client plan: sessions, body measurements and progress photos over the plan window.
/// </summary>
public class GetClientPlanSummaryResponse
{
    /// <summary>Public id of the plan.</summary>
    public Guid PlanId { get; set; }

    /// <summary>Plan name.</summary>
    public string PlanName { get; set; } = string.Empty;

    /// <summary>Plan kind: <c>nutrition</c> or <c>training</c>.</summary>
    public string Type { get; set; } = string.Empty;

    /// <summary>Plan status name.</summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>Full name of the coach who wrote the plan; null when that user no longer exists.</summary>
    public string? CoachName { get; set; }

    /// <summary>First day of the plan; null for a plan without a start date.</summary>
    public DateTime? StartDate { get; set; }

    /// <summary>Last day of the plan (the completion date when the plan ended early); null without a start date.</summary>
    public DateTime? EndDate { get; set; }

    /// <summary>Training sessions scheduled so far; null for nutrition plans and plans not yet started.</summary>
    public int? SessionsTotal { get; set; }

    /// <summary>Scheduled sessions the client completed; null whenever <see cref="SessionsTotal"/> is.</summary>
    public int? SessionsDone { get; set; }

    /// <summary>Weight near the start of the plan, in kg.</summary>
    public decimal? WeightStartKg { get; set; }

    /// <summary>Weight near the end of the plan, in kg.</summary>
    public decimal? WeightEndKg { get; set; }

    /// <summary>Waist near the start of the plan, in cm.</summary>
    public decimal? WaistStartCm { get; set; }

    /// <summary>Waist near the end of the plan, in cm.</summary>
    public decimal? WaistEndCm { get; set; }

    /// <summary>Earliest progress photo taken inside the plan window.</summary>
    public ClientPlanSummaryPhoto? FirstPhoto { get; set; }

    /// <summary>Latest progress photo taken inside the plan window (the same photo when there is only one).</summary>
    public ClientPlanSummaryPhoto? LastPhoto { get; set; }
}

/// <summary>
/// A progress photo shown in the plan summary.
/// </summary>
public class ClientPlanSummaryPhoto
{
    /// <summary>Public id of the photo.</summary>
    public Guid Id { get; set; }

    /// <summary>Short-lived signed URL to display the photo.</summary>
    public string DisplayUrl { get; set; } = string.Empty;

    /// <summary>When the photo was taken (UTC).</summary>
    public DateTime TakenAt { get; set; }
}
