using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.ClientRequests.GetMyRequests;

/// <summary>
/// Response model containing the client's sent requests.
/// </summary>
public class GetMyRequestsResponse
{
    public List<ClientRequestDto> Requests { get; set; } = [];
}

public class ClientRequestDto
{
    public Guid PublicId { get; set; }
    public Guid ProfessionalPublicId { get; set; }
    public string ProfessionalName { get; set; } = string.Empty;
    public string? Message { get; set; }
    public ClientRequestStatus Status { get; set; }
    public DateTime SentAt { get; set; }
    public DateTime? RespondedAt { get; set; }
}
