namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// What an automation rule asks of the client.
/// </summary>
public enum AutomationActionType
{
    /// <summary>Send a questionnaire to fill in.</summary>
    SendForm = 0,

    /// <summary>Ask for progress photos.</summary>
    RequestProgressPhotos = 1,

    /// <summary>Ask for body measurements.</summary>
    RequestMeasurements = 2,
}
