namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetMyCheckInHistory;

/// <summary>
/// Query parameters for <c>GET /client/weekly-check-ins/history</c>.
/// </summary>
public class GetMyCheckInHistoryRequest
{
    /// <summary>
    /// Page number (1-based). Defaults to 1.
    /// </summary>
    public int Page { get; set; } = 1;

    /// <summary>
    /// Number of items per page (1-100). Defaults to 20.
    /// </summary>
    public int PageSize { get; set; } = 20;
}
