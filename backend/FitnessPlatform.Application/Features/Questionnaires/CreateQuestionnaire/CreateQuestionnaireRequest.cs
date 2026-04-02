namespace FitnessPlatform.Application.Features.Questionnaires.CreateQuestionnaire;

public class CreateQuestionnaireRequest
{
    public string Title { get; set; } = null!;
    public string? Description { get; set; }
}
