namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.LinkPlan;

/// <summary>
/// Route + body for retroactively linking an existing photo diary request to a
/// nutrition or training plan. Diary-level (whole-diary) granularity — mirrors #777's
/// response-level linking rather than linking individual photos.
/// </summary>
public class LinkPlanRequest
{
    /// <summary>The photo diary request ID (from route).</summary>
    public Guid RequestId { get; set; }

    /// <summary>
    /// MongoDB external identifier of the nutrition or training plan to link.
    /// Must belong to the same client the diary request is attached to.
    /// </summary>
    public Guid PlanId { get; set; }
}
