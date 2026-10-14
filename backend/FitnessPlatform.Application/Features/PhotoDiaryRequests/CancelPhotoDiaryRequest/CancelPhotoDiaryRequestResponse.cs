using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.CancelPhotoDiaryRequest;

/// <summary>
/// Response returned after a coach cancels a photo diary request.
/// </summary>
public class CancelPhotoDiaryRequestResponse
{
    /// <summary>The cancelled request's ID.</summary>
    public Guid Id { get; set; }

    /// <summary>The new status (always <c>Cancelled</c>).</summary>
    public PhotoDiaryStatus Status { get; set; }
}
