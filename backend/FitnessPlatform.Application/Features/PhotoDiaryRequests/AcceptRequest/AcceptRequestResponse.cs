using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.AcceptRequest;

/// <summary>
/// Response returned after a client accepts a photo diary request.
/// </summary>
public class AcceptRequestResponse
{
    public Guid Id { get; set; }
    public PhotoDiaryStatus Status { get; set; }
    public PhotoDiaryMode? Mode { get; set; }
    public DateTimeOffset? AcceptedAt { get; set; }
}
