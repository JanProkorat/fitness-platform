using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.AcceptRequest;

/// <summary>
/// Route + body for accepting a photo diary request.
/// </summary>
public class AcceptRequestRequest
{
    /// <summary>The photo diary request ID (from route).</summary>
    public Guid Id { get; set; }

    /// <summary>
    /// The upload mode chosen by the client.
    /// Must be a valid <see cref="PhotoDiaryMode"/> value.
    /// </summary>
    public PhotoDiaryMode Mode { get; set; }
}
