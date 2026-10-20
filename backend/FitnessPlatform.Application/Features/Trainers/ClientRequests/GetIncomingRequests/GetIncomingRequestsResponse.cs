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

    /// <summary>Public id of the requesting client's profile.</summary>
    public Guid ClientPublicId { get; set; }

    /// <summary>Client height in cm, as on the coach client dashboard.</summary>
    public decimal? HeightCm { get; set; }

    /// <summary>Client weight in kg, as on the coach client dashboard.</summary>
    public decimal? WeightKg { get; set; }

    /// <summary>Onboarding primary goal (enum name), null when onboarding is not done.</summary>
    public string? PrimaryGoal { get; set; }

    /// <summary>Activity level derived at onboarding (enum name), null when not available.</summary>
    public string? DerivedActivityLevel { get; set; }
}
