namespace FitnessPlatform.Application.Features.Messaging.GetClientMessageStats;

/// <summary>
/// One ISO week's coach vs. client message counts for a trainer/client conversation.
/// </summary>
public class WeeklyMessageStatsDto
{
    /// <summary>
    /// The Monday that starts this ISO week, in the caller's time zone.
    /// </summary>
    public DateOnly WeekStart { get; set; }

    /// <summary>
    /// Messages sent by the caller (the trainer/nutritionist) during this week. Every
    /// system-generated message in a coach-client thread (broadcasts, invite greetings, request
    /// accept/reject) is attributed to the coach, so this counts those alongside typed replies —
    /// not just messages the coach personally typed.
    /// </summary>
    public int CoachMessages { get; set; }

    /// <summary>
    /// Messages sent by the client during this week.
    /// </summary>
    public int ClientMessages { get; set; }
}
