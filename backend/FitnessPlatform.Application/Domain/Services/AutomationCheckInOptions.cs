namespace FitnessPlatform.Application.Domain.Services;

/// <summary>
/// The values a check-in rule accepts for its answer window and reminder, as the Weekly check-in
/// rule board offers them: "Answer within 2 days" and "Remind the client after 24 h".
/// </summary>
public static class AutomationCheckInOptions
{
    /// <summary>Hours after the send in which the client can answer before the week counts as missed.</summary>
    public static readonly IReadOnlyList<int> AnswerWindowHours = [48];

    /// <summary>Hours after the send at which an unanswered check-in is reminded.</summary>
    public static readonly IReadOnlyList<int> ReminderAfterHours = [24];
}
