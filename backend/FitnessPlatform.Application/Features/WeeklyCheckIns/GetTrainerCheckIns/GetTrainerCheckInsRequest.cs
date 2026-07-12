namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetTrainerCheckIns;

/// <summary>
/// Query parameters for GET /trainer/weekly-check-ins.
/// </summary>
public class GetTrainerCheckInsRequest
{
    /// <summary>
    /// ISO-week Monday to filter by (YYYY-MM-DD). Optional — when omitted, the endpoint
    /// returns the active (not dismissed, not yet reviewed) set across all weeks.
    /// </summary>
    public DateOnly? WeekStartDate { get; set; }
}
