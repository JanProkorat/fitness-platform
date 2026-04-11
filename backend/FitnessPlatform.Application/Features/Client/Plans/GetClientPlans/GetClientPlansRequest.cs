namespace FitnessPlatform.Application.Features.Client.Plans.GetClientPlans;

/// <summary>
/// Optional query parameters for filtering client plans.
/// </summary>
public class GetClientPlansRequest
{
    /// <summary>
    /// Filter by plan status (e.g. "Completed", "Active").
    /// When null, returns all non-draft plans.
    /// </summary>
    public string? Status { get; set; }
}
