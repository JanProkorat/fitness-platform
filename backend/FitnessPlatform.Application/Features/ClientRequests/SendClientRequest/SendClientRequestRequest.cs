namespace FitnessPlatform.Application.Features.ClientRequests.SendClientRequest;

/// <summary>
/// Request model for sending a client request to a professional.
/// </summary>
public class SendClientRequestRequest
{
    /// <summary>
    /// Public identifier of the professional to send the request to.
    /// </summary>
    public Guid ProfessionalPublicId { get; set; }

    /// <summary>
    /// Optional message to include with the request.
    /// </summary>
    public string? Message { get; set; }
}
