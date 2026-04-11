namespace FitnessPlatform.Application.Features.Questionnaires.GetClientPendingQuestionnaires;

public class GetClientPendingQuestionnairesResponse
{
    public List<PendingQuestionnaireItem> Items { get; set; } = [];
}

public class PendingQuestionnaireItem
{
    public Guid LinkPublicId { get; set; }
    public string ProfessionalName { get; set; } = string.Empty;
    public string? ProfessionalRole { get; set; }
    public Guid? QuestionnairePublicId { get; set; }
    public string? QuestionnaireTitle { get; set; }
    public int QuestionCount { get; set; }
    public Guid? ResponsePublicId { get; set; }
    public string? ResponseStatus { get; set; }
}
