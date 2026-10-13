namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetClientCheckInHistory;

/// <summary>
/// Weekly check-in history of one client for the authenticated professional.
/// </summary>
public class GetClientCheckInHistoryResponse
{
    /// <summary>Weekly slots, oldest first. The last slot is the newest check-in week.</summary>
    public List<CheckInHistoryWeekDto> Weeks { get; set; } = [];

    /// <summary>Number of weeks the client answered, over all of the caller's check-ins for the client.</summary>
    public int AnsweredCount { get; set; }

    /// <summary>Number of answered plus missed weeks; in-flight (waiting) weeks are excluded.</summary>
    public int TotalCount { get; set; }
}

/// <summary>
/// One weekly slot in the check-in history.
/// </summary>
public class CheckInHistoryWeekDto
{
    /// <summary>ISO-week Monday of the slot.</summary>
    public DateOnly WeekStartDate { get; set; }

    /// <summary>One of "answered", "missed", "waiting" or "none".</summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>UTC time the check-in that decided this week's status was sent; null for a "none" week.</summary>
    public DateTime? SentAt { get; set; }

    /// <summary>Hunger score (1-5) the client gave in the deciding check-in; null when none was given.</summary>
    public int? HungerScore { get; set; }
}
