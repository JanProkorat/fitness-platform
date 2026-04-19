namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetTrainerCheckIns;

/// <summary>
/// Query parameters for GET /trainer/weekly-check-ins.
/// </summary>
public class GetTrainerCheckInsRequest
{
    /// <summary>
    /// ISO-week Monday to filter by (YYYY-MM-DD). Required.
    /// </summary>
    public DateOnly WeekStartDate { get; set; }
}
