using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Client.Profile.GetClientProfileSummary;

/// <summary>
/// Headline numbers for the client's own Profile screen.
/// </summary>
public class GetClientProfileSummaryResponse
{
    /// <summary>Primary goal from onboarding; null when the client has not onboarded.</summary>
    public PrimaryGoal? Goal { get; set; }

    /// <summary>When the account was created (UTC).</summary>
    public DateTime MemberSince { get; set; }

    /// <summary>Most recent recorded weight in kg; null when no weight was ever recorded.</summary>
    public decimal? LatestWeightKg { get; set; }

    /// <summary>Latest minus earliest recorded weight in kg; 0 with one weight, null with none.</summary>
    public decimal? WeightChangeSinceStartKg { get; set; }

    /// <summary>Plans (nutrition + training) the client can open: not draft, with a published week.</summary>
    public int PlanCount { get; set; }

    /// <summary>Training session executions that count as complete.</summary>
    public int CompletedWorkoutCount { get; set; }

    /// <summary>Body and free-form photos, linked to a plan or not.</summary>
    public int ProgressPhotoCount { get; set; }

    /// <summary>Weekly check-ins addressed to the client.</summary>
    public int CheckInCount { get; set; }
}
