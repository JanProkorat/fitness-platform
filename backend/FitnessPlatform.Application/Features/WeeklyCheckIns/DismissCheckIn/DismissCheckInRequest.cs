namespace FitnessPlatform.Application.Features.WeeklyCheckIns.DismissCheckIn;

/// <summary>
/// Request for POST /client/weekly-check-ins/{id}/dismiss.
/// </summary>
public class DismissCheckInRequest
{
    /// <summary>Route parameter — check-in identifier.</summary>
    public Guid Id { get; set; }
}
