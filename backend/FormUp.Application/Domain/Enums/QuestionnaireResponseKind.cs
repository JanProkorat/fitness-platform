namespace FormUp.Application.Domain.Enums;

/// <summary>
/// Which kind of form a questionnaire response belongs to. Set when the response is created, never
/// inferred afterwards.
/// </summary>
public enum QuestionnaireResponseKind
{
    /// <summary>The form a client fills in when joining a coach.</summary>
    Onboarding = 0,

    /// <summary>A form the coach sent on their own or through an automation rule.</summary>
    Questionnaire = 1,

    /// <summary>A recurring check-in form.</summary>
    CheckIn = 2,
}
