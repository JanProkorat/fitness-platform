namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Whether an event trigger's day offset lands after or before the event.
/// </summary>
public enum AutomationOffsetDirection
{
    /// <summary>The request goes out the given number of days after the event.</summary>
    After = 0,

    /// <summary>The request goes out the given number of days before the event.</summary>
    Before = 1,
}
