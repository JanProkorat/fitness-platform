namespace FitnessPlatform.Application.Features.WeeklyCheckIns.MarkCheckInReviewed;

/// <summary>
/// Response for POST /trainer/weekly-check-ins/{id}/mark-reviewed.
/// </summary>
public class MarkCheckInReviewedResponse
{
    /// <summary>Check-in identifier.</summary>
    public Guid Id { get; set; }

    /// <summary>When the trainer marked the check-in reviewed (UTC).</summary>
    public DateTime ReviewedAt { get; set; }
}
