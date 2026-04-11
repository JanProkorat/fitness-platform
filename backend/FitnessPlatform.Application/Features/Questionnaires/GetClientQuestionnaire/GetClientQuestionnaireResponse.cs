namespace FitnessPlatform.Application.Features.Questionnaires.GetClientQuestionnaire;

public class GetClientQuestionnaireResponse
{
    public Guid QuestionnairePublicId { get; set; }
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
    public Guid LinkPublicId { get; set; }
    public string ProfessionalName { get; set; } = string.Empty;
    public string? ProfessionalRole { get; set; }
    public string? ProfessionalCity { get; set; }
    public int QuestionCount { get; set; }
    public List<ClientQuestionDto> Questions { get; set; } = [];
    public Guid? ExistingResponsePublicId { get; set; }
    public string? ExistingResponseStatus { get; set; }
    public List<ClientAnswerDto>? ExistingAnswers { get; set; }
}

public class ClientQuestionDto
{
    public Guid PublicId { get; set; }
    public int OrderIndex { get; set; }
    public string Type { get; set; } = null!;
    public string Label { get; set; } = null!;
    public string? HelperText { get; set; }
    public bool IsRequired { get; set; }
    public string? Config { get; set; }
}

public class ClientAnswerDto
{
    public Guid QuestionPublicId { get; set; }
    public string? ValueText { get; set; }
    public decimal? ValueNumber { get; set; }
    public string? ValueJson { get; set; }
    public string? FileUrl { get; set; }
}
