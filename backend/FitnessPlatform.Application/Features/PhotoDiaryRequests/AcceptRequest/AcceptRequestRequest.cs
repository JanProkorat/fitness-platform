namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.AcceptRequest;

/// <summary>
/// Route for accepting a photo diary request. The mode was chosen by the coach at creation,
/// so the client sends an empty body.
/// </summary>
public class AcceptRequestRequest
{
    /// <summary>The photo diary request ID (from route).</summary>
    public Guid Id { get; set; }
}
