namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// What a questionnaire is used for. Fixed when the form is created.
/// </summary>
public enum QuestionnaireType
{
    /// <summary>Sent to a client when they join; the only type that can be the default form.</summary>
    Onboarding = 0,

    /// <summary>Used for the recurring check-in; never sent through the onboarding paths.</summary>
    CheckIn = 1,
}
