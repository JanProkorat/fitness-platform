namespace FitnessPlatform.Application.Features.Trainers.ReviewAllClientOfflineSyncConflicts;

/// <summary>
/// Request for marking all of a client's conflicts on one plan reviewed.
/// </summary>
public class ReviewAllClientOfflineSyncConflictsRequest
{
    /// <summary>The client's <c>ClientProfile.PublicId</c> (route parameter).</summary>
    public Guid ClientId { get; set; }

    /// <summary>The plan whose conflicts are reviewed.</summary>
    public Guid PlanId { get; set; }
}
