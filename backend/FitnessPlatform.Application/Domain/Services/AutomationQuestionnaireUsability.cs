using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// Whether a questionnaire can be sent by an automation rule. The rule endpoints and the sender
/// both use it, so a form the endpoints accept is a form the sender can deliver.
/// </summary>
public static class AutomationQuestionnaireUsability
{
    /// <summary>A usable form is active and is not a weekly check-in form.</summary>
    /// <param name="isActive">Whether the questionnaire is active.</param>
    /// <param name="type">The questionnaire type.</param>
    public static bool IsUsable(bool isActive, QuestionnaireType type) =>
        isActive && type != QuestionnaireType.CheckIn;
}
