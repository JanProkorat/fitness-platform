using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.ClientRequests.SendClientRequest;

/// <summary>
/// Response model returned after sending a client request.
/// </summary>
public class SendClientRequestResponse
{
    public Guid PublicId { get; set; }
    public Guid ProfessionalPublicId { get; set; }
    public string ProfessionalName { get; set; } = string.Empty;
    public string? Message { get; set; }
    public ClientRequestStatus Status { get; set; }
    public DateTime SentAt { get; set; }
}
