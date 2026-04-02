namespace FitnessPlatform.Application.Features.Questionnaires.Dtos;

public class QuestionDto
{
    public Guid PublicId { get; set; }
    public int OrderIndex { get; set; }
    public string Type { get; set; } = null!;
    public string Label { get; set; } = null!;
    public string? HelperText { get; set; }
    public bool IsRequired { get; set; }
    public bool IsHidden { get; set; }
    public string? Config { get; set; }
    public string? MappedField { get; set; }
}
