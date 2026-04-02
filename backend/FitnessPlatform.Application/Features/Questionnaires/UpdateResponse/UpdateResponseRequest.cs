namespace FitnessPlatform.Application.Features.Questionnaires.UpdateResponse;

public class UpdateResponseRequest
{
    public Guid ResponsePublicId { get; set; }
    public List<AnswerDto> Answers { get; set; } = [];
}

public class AnswerDto
{
    public Guid QuestionPublicId { get; set; }
    public string? ValueText { get; set; }
    public decimal? ValueNumber { get; set; }
    public string? ValueJson { get; set; }
    public string? FileUrl { get; set; }
}
