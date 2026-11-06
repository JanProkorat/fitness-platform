using FormUp.Application.Domain.Common;
using FormUp.Application.Domain.Enums;

namespace FormUp.Application.Domain.Entities;

/// <summary>
/// A burst of events that will be sent as one grouped notification email once it falls due. There is at most
/// one row per recipient, event and group; the row carries timing only, never any content of the events.
/// </summary>
public class PendingNotificationEmail : TimestampableEntity
{
    /// <summary>
    /// The user who will receive the email.
    /// </summary>
    public Guid RecipientUserId { get; set; }

    /// <summary>
    /// The event the email is about; selects the grouping window and the template.
    /// </summary>
    public NotificationEvent Event { get; set; }

    /// <summary>
    /// What the burst is grouped by. For a new message this is the conversation's public id.
    /// </summary>
    public Guid GroupId { get; set; }

    /// <summary>
    /// When the first event of the burst happened (UTC).
    /// </summary>
    public DateTime FirstEventAt { get; set; }

    /// <summary>
    /// When the latest event of the burst happened (UTC).
    /// </summary>
    public DateTime LastEventAt { get; set; }

    /// <summary>
    /// When the email is due (UTC); see <c>NotificationEmailGrouping.DueAt</c>.
    /// </summary>
    public DateTime DueAt { get; set; }

    /// <summary>
    /// Navigation property to the recipient.
    /// </summary>
    public ApplicationUser User { get; set; } = null!;
}
