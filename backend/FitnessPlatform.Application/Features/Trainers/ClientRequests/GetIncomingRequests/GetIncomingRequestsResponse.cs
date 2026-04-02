namespace FitnessPlatform.Application.Features.Trainers.ClientRequests.GetIncomingRequests;

/// <summary>
/// Response model containing incoming client requests for a professional.
/// </summary>
public class GetIncomingRequestsResponse
{
    public List<IncomingClientRequestDto> Requests { get; set; } = [];
}

public class IncomingClientRequestDto
{
    public Guid PublicId { get; set; }
    public string ClientFirstName { get; set; } = string.Empty;
    public string ClientLastName { get; set; } = string.Empty;
    public string ClientEmail { get; set; } = string.Empty;
    public string? Message { get; set; }
    public DateTime SentAt { get; set; }
}
