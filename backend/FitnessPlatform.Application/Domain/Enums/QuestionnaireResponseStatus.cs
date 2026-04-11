namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Status of a questionnaire response submitted by a client.
/// </summary>
public enum QuestionnaireResponseStatus
{
    Pending = 0,
    InProgress = 1,
    Submitted = 2,
    Cancelled = 3
}
