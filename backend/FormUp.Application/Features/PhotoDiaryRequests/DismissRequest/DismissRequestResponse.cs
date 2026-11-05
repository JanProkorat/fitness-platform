using FormUp.Application.Domain.Enums;

namespace FormUp.Application.Features.PhotoDiaryRequests.DismissRequest;

/// <summary>
/// Response returned after a client dismisses a photo diary request.
/// </summary>
public class DismissRequestResponse
{
    public Guid Id { get; set; }
    public PhotoDiaryStatus Status { get; set; }
    public string? DismissReason { get; set; }
}
