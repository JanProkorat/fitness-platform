namespace FitnessPlatform.Application.Features.Trainers.GetClientOfflineSyncConflicts;

/// <summary>
/// Request for listing a client's offline-sync conflicts.
/// </summary>
public class GetClientOfflineSyncConflictsRequest
{
    /// <summary>The client's <c>ClientProfile.PublicId</c> (route parameter).</summary>
    public Guid ClientId { get; set; }

    /// <summary>1-based page number.</summary>
    public int Page { get; set; } = 1;

    /// <summary>Items per page (1 to 100).</summary>
    public int PageSize { get; set; } = 20;
}
