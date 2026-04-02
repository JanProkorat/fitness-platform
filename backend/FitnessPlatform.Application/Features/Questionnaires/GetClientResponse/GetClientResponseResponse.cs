namespace FitnessPlatform.Application.Features.Questionnaires.GetClientResponse;

public class GetClientResponseResponse
{
    public Guid ResponsePublicId { get; set; }
    public string QuestionnaireTitle { get; set; } = null!;
    public DateTime? SubmittedAt { get; set; }
    public int AnswerCount { get; set; }
    public List<ResponseAnswerDto> Answers { get; set; } = [];
}

public class ResponseAnswerDto
{
    public Guid QuestionPublicId { get; set; }
    public string QuestionLabel { get; set; } = null!;
    public string QuestionType { get; set; } = null!;
    public string? MappedField { get; set; }
    public string? ValueText { get; set; }
    public decimal? ValueNumber { get; set; }
    public string? ValueJson { get; set; }
    public string? FileUrl { get; set; }
}
