namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// The answer windows a check-in rule accepts (1 to 7 days) and the reminder delay each one pairs with.
/// </summary>
public static class AutomationCheckInOptions
{
    /// <summary>Hours after the send in which the client can answer before the week counts as missed.</summary>
    public static readonly IReadOnlyList<int> AnswerWindowHours = [24, 48, 72, 96, 120, 144, 168];

    /// <summary>Every reminder delay a rule can carry: 12 h for a 24 h window, 24 h otherwise.</summary>
    public static readonly IReadOnlyList<int> ReminderAfterHours = [12, 24];

    /// <summary>The reminder delay for a window: half the window, capped at 24 h.</summary>
    public static int ReminderHoursFor(int answerWindowHours) => Math.Min(24, answerWindowHours / 2);
}
