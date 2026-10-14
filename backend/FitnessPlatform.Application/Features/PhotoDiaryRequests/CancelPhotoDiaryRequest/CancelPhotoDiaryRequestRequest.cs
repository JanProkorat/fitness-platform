namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.CancelPhotoDiaryRequest;

/// <summary>
/// Route for cancelling a photo diary request. Clients post an empty JSON body.
/// </summary>
public class CancelPhotoDiaryRequestRequest
{
    /// <summary>The photo diary request ID (from route).</summary>
    public Guid Id { get; set; }
}
