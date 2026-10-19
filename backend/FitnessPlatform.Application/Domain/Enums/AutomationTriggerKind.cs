namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// How an automation rule is triggered.
/// </summary>
public enum AutomationTriggerKind
{
    /// <summary>Every N days or weeks at a local time, counted from the client's start date.</summary>
    Schedule = 0,

    /// <summary>When an event happens to the client, with an optional day offset.</summary>
    Event = 1,
}
