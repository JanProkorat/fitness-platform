namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Which of the coach's clients a global automation rule applies to.
/// </summary>
public enum AutomationAudience
{
    /// <summary>Every client with a live link to the coach.</summary>
    All = 0,

    /// <summary>Clients carrying one of the coach's tags.</summary>
    Tag = 1,

    /// <summary>An explicit list of clients.</summary>
    Chosen = 2,
}
