namespace FitnessPlatform.Application.Features.Professionals.SearchProfessionals;

public class SearchProfessionalsRequest
{
    public string? City { get; set; }
    public string? Specialization { get; set; }
    public string? Role { get; set; }
    public string? Search { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}
