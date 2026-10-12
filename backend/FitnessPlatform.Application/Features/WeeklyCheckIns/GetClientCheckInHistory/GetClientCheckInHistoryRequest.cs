namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetClientCheckInHistory;

/// <summary>
/// Request for GET /trainer/clients/{clientUserId}/weekly-check-ins/history.
/// </summary>
public class GetClientCheckInHistoryRequest
{
    /// <summary>Client's ApplicationUser.Id (route parameter).</summary>
    public Guid ClientUserId { get; set; }

    /// <summary>Number of weekly slots to return, ending at the newest check-in week. Default 8, 1 to 26.</summary>
    public int Weeks { get; set; } = 8;
}
