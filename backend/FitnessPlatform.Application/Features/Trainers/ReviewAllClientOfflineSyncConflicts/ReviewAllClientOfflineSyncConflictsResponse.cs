namespace FitnessPlatform.Application.Features.Trainers.ReviewAllClientOfflineSyncConflicts;

/// <summary>
/// Result of reviewing all of a client's conflicts on one plan.
/// </summary>
public class ReviewAllClientOfflineSyncConflictsResponse
{
    /// <summary>How many conflicts were newly marked reviewed.</summary>
    public int ReviewedCount { get; set; }
}
