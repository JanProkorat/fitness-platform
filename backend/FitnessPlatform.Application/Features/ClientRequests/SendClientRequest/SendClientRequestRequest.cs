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

    /// <summary>
    /// Optional: whether the client agrees to share their history with the professional. Stored only; not enforced yet.
    /// </summary>
    public bool ShareHistory { get; set; }

    /// <summary>
    /// Optional public id of one of the coach's packages shown on their profile, to be applied when the coach accepts.
    /// </summary>
    public Guid? PackagePublicId { get; set; }
}
