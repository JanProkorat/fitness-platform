namespace FitnessPlatform.Application.Features.Questionnaires.GetClientQuestionnaire;

/// <summary>
/// Query parameters of GET /client/questionnaire.
/// </summary>
public class GetClientQuestionnaireRequest
{
    /// <summary>Selects which coach's questionnaire to load; omitted falls back to the first active link.</summary>
    public Guid? LinkPublicId { get; set; }

    /// <summary>Loads the questionnaire of one open response; takes precedence over the link.</summary>
    public Guid? ResponsePublicId { get; set; }
}
