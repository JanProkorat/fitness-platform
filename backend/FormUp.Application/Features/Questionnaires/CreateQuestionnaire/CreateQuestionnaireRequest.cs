using FormUp.Application.Domain.Enums;

namespace FormUp.Application.Features.Questionnaires.CreateQuestionnaire;

public class CreateQuestionnaireRequest
{
    public string Title { get; set; } = null!;
    public string? Description { get; set; }

    /// <summary>Form type; fixed after creation. Defaults to Onboarding.</summary>
    public QuestionnaireType Type { get; set; } = QuestionnaireType.Onboarding;
}
