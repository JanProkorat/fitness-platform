namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.SubmitRequest;

/// <summary>
/// Route parameters for submitting / finalizing a photo diary.
/// </summary>
public class SubmitRequestRequest
{
    /// <summary>The photo diary request ID (from route).</summary>
    public Guid Id { get; set; }
}
