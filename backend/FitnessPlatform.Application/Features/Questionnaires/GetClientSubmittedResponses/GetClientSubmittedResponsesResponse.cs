namespace FitnessPlatform.Application.Features.Questionnaires.GetClientSubmittedResponses;

public class GetClientSubmittedResponsesResponse
{
    public List<CoachQuestionnairesItem> Coaches { get; set; } = [];
}

public class CoachQuestionnairesItem
{
    public Guid LinkPublicId { get; set; }
    public string ProfessionalName { get; set; } = string.Empty;
    public string? ProfessionalRole { get; set; }
    public List<SubmittedResponseItem> Responses { get; set; } = [];
}

public class SubmittedResponseItem
{
    public Guid ResponsePublicId { get; set; }
    public string QuestionnaireTitle { get; set; } = null!;
    public DateTime? SubmittedAt { get; set; }
    public List<SubmittedAnswerItem> Answers { get; set; } = [];
}

public class SubmittedAnswerItem
{
    public string Label { get; set; } = null!;
    public string Type { get; set; } = null!;
    public string? ValueText { get; set; }
    public decimal? ValueNumber { get; set; }
    public string? ValueJson { get; set; }
    public string? Config { get; set; }
}
