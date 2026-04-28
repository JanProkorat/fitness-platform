namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.DismissRequest;

/// <summary>
/// Route + body for dismissing a photo diary request.
/// </summary>
public class DismissRequestRequest
{
    /// <summary>The photo diary request ID (from route).</summary>
    public Guid Id { get; set; }

    /// <summary>Optional reason for dismissal (max 500 characters).</summary>
    public string? Reason { get; set; }
}
