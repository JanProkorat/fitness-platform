using FormUp.Application.Domain.Enums;

namespace FormUp.Application.Features.PhotoDiaryRequests.SubmitRequest;

/// <summary>
/// Response returned after a client submits / finalizes a photo diary.
/// </summary>
public class SubmitRequestResponse
{
    public Guid Id { get; set; }
    public PhotoDiaryStatus Status { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
}
