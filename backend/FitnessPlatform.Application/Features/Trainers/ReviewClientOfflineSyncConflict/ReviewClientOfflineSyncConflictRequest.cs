namespace FitnessPlatform.Application.Features.Trainers.ReviewClientOfflineSyncConflict;

/// <summary>
/// Request for marking one offline-sync conflict reviewed.
/// </summary>
public class ReviewClientOfflineSyncConflictRequest
{
    /// <summary>The client's <c>ClientProfile.PublicId</c> (route parameter).</summary>
    public Guid ClientId { get; set; }

    /// <summary>The conflict's public id (route parameter).</summary>
    public Guid ConflictId { get; set; }
}
