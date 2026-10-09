using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// A user's saved email and push choice for one notification event. A missing row means the default
/// from <c>NotificationPreferenceDefaults</c>.
/// </summary>
public class NotificationPreference : TimestampableEntity
{
    /// <summary>
    /// The user these preferences belong to.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// The event this row configures.
    /// </summary>
    public NotificationEvent Event { get; set; }

    /// <summary>
    /// Whether email delivery is enabled for the event.
    /// </summary>
    public bool EmailEnabled { get; set; }

    /// <summary>
    /// Whether push delivery is enabled for the event.
    /// </summary>
    public bool PushEnabled { get; set; }

    /// <summary>
    /// Navigation property to the user.
    /// </summary>
    public ApplicationUser User { get; set; } = null!;
}
