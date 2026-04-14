namespace FitnessPlatform.Application.Features.Trainers.GetClientTimeline;

/// <summary>
/// Request model for retrieving a client's activity timeline.
/// </summary>
public class GetClientTimelineRequest
{
    /// <summary>
    /// The client's ApplicationUser.Id, provided as a route parameter.
    /// </summary>
    public Guid ClientId { get; set; }

    /// <summary>
    /// Maximum number of items to return. Defaults to 30, capped at 100.
    /// </summary>
    public int Limit { get; set; } = 30;
}
