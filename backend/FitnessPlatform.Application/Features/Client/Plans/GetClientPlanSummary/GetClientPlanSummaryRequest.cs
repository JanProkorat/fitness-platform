namespace FitnessPlatform.Application.Features.Client.Plans.GetClientPlanSummary;

/// <summary>
/// Request for the client's summary of one of their plans.
/// </summary>
public class GetClientPlanSummaryRequest
{
    /// <summary>Route parameter — public id of the nutrition or training plan.</summary>
    public Guid PlanId { get; set; }
}
