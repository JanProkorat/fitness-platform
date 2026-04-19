namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetCheckInDetail;

/// <summary>
/// Request for GET /trainer/weekly-check-ins/{id}.
/// </summary>
public class GetCheckInDetailRequest
{
    /// <summary>Check-in identifier (route parameter).</summary>
    public Guid Id { get; set; }
}
