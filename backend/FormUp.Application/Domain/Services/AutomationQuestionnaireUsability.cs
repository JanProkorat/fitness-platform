using FormUp.Application.Domain.Enums;

namespace FormUp.Application.Domain.Services;

/// <summary>
/// Whether a questionnaire can be sent by an automation rule. The rule endpoints and the sender
/// both use it, so a form the endpoints accept is a form the sender can deliver.
/// </summary>
public static class AutomationQuestionnaireUsability
{
    /// <summary>A usable form is active; a check-in form is usable too, as a check-in rule.</summary>
    /// <param name="isActive">Whether the questionnaire is active.</param>
    public static bool IsUsable(bool isActive) => isActive;

    /// <summary>Whether a rule that sends this form is a weekly check-in rule.</summary>
    /// <param name="type">The questionnaire type.</param>
    public static bool IsCheckInForm(QuestionnaireType type) => type == QuestionnaireType.CheckIn;
}
