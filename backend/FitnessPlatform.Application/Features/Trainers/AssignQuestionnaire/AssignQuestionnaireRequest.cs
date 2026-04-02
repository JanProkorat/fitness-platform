namespace FitnessPlatform.Application.Features.Trainers.AssignQuestionnaire;

/// <summary>
/// Request model for assigning a questionnaire to an existing client.
/// </summary>
public class AssignQuestionnaireRequest
{
    /// <summary>
    /// Public identifier of the client (from route).
    /// </summary>
    public Guid ClientPublicId { get; set; }

    /// <summary>
    /// Public identifier of the questionnaire to assign.
    /// </summary>
    public Guid QuestionnairePublicId { get; set; }
}
