namespace FitnessPlatform.Application.Features.Professionals.GetPublicProfile;

public class GetPublicProfileResponse
{
    public Guid PublicId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Bio { get; set; }
    public List<string> Specializations { get; set; } = [];
    public List<string> Certificates { get; set; } = [];
    public List<string> Languages { get; set; } = [];
    public string? City { get; set; }
    public string? EstimatedPrice { get; set; }
    public string? CollaborationType { get; set; }
    public string? LinkedIn { get; set; }
    public string? Instagram { get; set; }
    public string? Website { get; set; }
    public List<string> Roles { get; set; } = [];
    public bool HasPendingRequest { get; set; }
    public bool IsLinked { get; set; }
}
