namespace FitnessPlatform.Application.Features.WeeklyCheckIns.DismissCheckIn;

/// <summary>
/// Response for POST /client/weekly-check-ins/{id}/dismiss.
/// </summary>
public class DismissCheckInResponse
{
    /// <summary>Check-in identifier.</summary>
    public Guid Id { get; set; }

    /// <summary>When the check-in was dismissed (UTC).</summary>
    public DateTime DismissedAt { get; set; }
}
