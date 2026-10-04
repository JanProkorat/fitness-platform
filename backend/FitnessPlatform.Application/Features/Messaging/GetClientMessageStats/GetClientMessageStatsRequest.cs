namespace FitnessPlatform.Application.Features.Messaging.GetClientMessageStats;

/// <summary>
/// Request model for retrieving a client's weekly coach/client message counts.
/// </summary>
public class GetClientMessageStatsRequest
{
    /// <summary>
    /// The client profile's public identifier (route parameter).
    /// </summary>
    public Guid ClientId { get; set; }

    /// <summary>
    /// Number of ISO weeks to return, oldest first, including the current partial week.
    /// Defaults to 4.
    /// </summary>
    public int Weeks { get; set; } = 4;
}
