namespace FitnessPlatform.Application.Features.WeeklyCheckIns.MarkCheckInReviewed;

/// <summary>
/// Request for POST /trainer/weekly-check-ins/{id}/mark-reviewed.
/// </summary>
public class MarkCheckInReviewedRequest
{
    /// <summary>Check-in identifier (route parameter).</summary>
    public Guid Id { get; set; }
}
