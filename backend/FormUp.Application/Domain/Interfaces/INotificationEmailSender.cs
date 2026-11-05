using FormUp.Application.Domain.Enums;

namespace FormUp.Application.Domain.Interfaces;

/// <summary>
/// Queues the coach notification email for an event when the recipient's email switch is on.
/// Never throws: a failed email must not fail the request that triggered it.
/// </summary>
public interface INotificationEmailSender
{
    /// <summary>
    /// Queues the email unless the recipient turned the event's email off. A saved preference wins;
    /// without one, <c>NotificationPreferenceDefaults</c> decides.
    /// </summary>
    /// <param name="recipientUserId">The coach to email.</param>
    /// <param name="notificationEvent">The event, which selects the template and the switch.</param>
    /// <param name="values">Plain-text values keyed by the <see cref="NotificationEmailWorkItem"/> constants, plus
    /// <see cref="NotificationEmailWorkItem.ClientNameKey"/>. A <c>ClientPublicId</c> entry builds the portal link.</param>
    /// <param name="ct">Cancellation token.</param>
    Task SendAsync(
        Guid recipientUserId,
        NotificationEvent notificationEvent,
        IReadOnlyDictionary<string, string> values,
        CancellationToken ct);
}
