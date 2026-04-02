namespace FitnessPlatform.Application.Features.Professionals.SearchProfessionals;

public class SearchProfessionalsResponse
{
    public List<ProfessionalSummaryDto> Items { get; set; } = [];
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}

public class ProfessionalSummaryDto
{
    public Guid PublicId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Bio { get; set; }
    public List<string> Specializations { get; set; } = [];
    public string? City { get; set; }
    public string? EstimatedPrice { get; set; }
    public string? CollaborationType { get; set; }
    public List<string> Languages { get; set; } = [];
    public List<string> Roles { get; set; } = [];
}
