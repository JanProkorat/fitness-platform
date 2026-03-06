namespace FitnessPlatform.Application.Features.Trainers.GetClientDashboard;

/// <summary>
/// Request model for retrieving a client's dashboard summary.
/// </summary>
public class GetClientDashboardRequest
{
    /// <summary>
    /// The client's public ID, provided as a route parameter.
    /// </summary>
    public Guid ClientId { get; set; }
}
