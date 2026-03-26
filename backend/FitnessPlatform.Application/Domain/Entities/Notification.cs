using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Represents a notification sent to a user. Stored in PostgreSQL for relational references and in-app history.
/// </summary>
public class Notification : PublicTimestampableEntity
{
    /// <summary>
    /// The user who should receive this notification (matches ApplicationUser.Id).
    /// </summary>
    public Guid RecipientUserId { get; set; }

    /// <summary>
    /// Type of notification.
    /// </summary>
    public NotificationType Type { get; set; }

    /// <summary>
    /// Notification title (e.g. "New Personal Record!").
    /// </summary>
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Notification body (e.g. "Petra achieved a new PR in Bench Press: 60 kg x 8").
    /// </summary>
    [MaxLength(1000)]
    public string Body { get; set; } = string.Empty;

    /// <summary>
    /// Whether this notification has been sent via push.
    /// </summary>
    public bool IsSent { get; set; }

    /// <summary>
    /// When this notification was sent via push. Null if not yet sent.
    /// </summary>
    public DateTime? SentAt { get; set; }

    /// <summary>
    /// Whether this notification has been read by the user.
    /// </summary>
    public bool IsRead { get; set; }

    /// <summary>
    /// Optional JSON payload with additional data (e.g. exerciseId, workoutLogId).
    /// </summary>
    [MaxLength(2000)]
    public string? Data { get; set; }

    /// <summary>
    /// Navigation property to the recipient user.
    /// </summary>
    public ApplicationUser Recipient { get; set; } = null!;
}
