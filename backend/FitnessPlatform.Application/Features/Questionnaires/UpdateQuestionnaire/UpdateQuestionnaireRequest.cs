namespace FitnessPlatform.Application.Features.Questionnaires.UpdateQuestionnaire;

public class UpdateQuestionnaireRequest
{
    public Guid PublicId { get; set; }
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public bool IsDefault { get; set; }
    public List<UpdateQuestionDto> Questions { get; set; } = [];
}

public class UpdateQuestionDto
{
    public Guid? PublicId { get; set; }
    public int OrderIndex { get; set; }
    public string Type { get; set; } = null!;
    public string Label { get; set; } = null!;
    public string? HelperText { get; set; }
    public bool IsRequired { get; set; }
    public bool IsHidden { get; set; }
    public string? Config { get; set; }
    public string? MappedField { get; set; }
}
