namespace FitnessPlatform.Application.Features.ClientRequests.CancelClientRequest;

/// <summary>
/// Request for cancelling a pending client request.
/// </summary>
public class CancelClientRequestRequest
{
    /// <summary>Route parameter — public id of the request to cancel.</summary>
    public Guid PublicId { get; set; }
}
