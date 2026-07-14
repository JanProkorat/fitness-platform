using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Service for creating notifications in the database.
/// </summary>
public interface INotificationService
{
    /// <summary>
    /// Creates a notification for the specified user, localized to the recipient's
    /// stored <see cref="Entities.ApplicationUser.Language"/> (falls back to English
    /// when unset — #788). The same localized title/body are used for both the
    /// persisted in-app notification and the push notification, since the OS-level
    /// push banner must already be in the right language at send time.
    /// </summary>
    /// <param name="recipientUserId">The recipient's ApplicationUser.Id.</param>
    /// <param name="type">Type of notification — selects the title/body template.</param>
    /// <param name="parameters">
    /// Interpolation values for the template's <c>{key}</c> placeholders (e.g.
    /// <c>{ ["clientName"] = "Petra Nováková" }</c>). Also persisted verbatim as JSON in
    /// <see cref="Entities.Notification.Data"/> so any extra keys (e.g. an id needed for
    /// client-side deep-linking) ride along even if the current templates don't use them.
    /// </param>
    /// <param name="variant">
    /// Distinguishes multiple title/body wordings under the same <paramref name="type"/> —
    /// see the named constants on <see cref="Infrastructure.Services.NotificationTemplates"/>.
    /// Null for types with a single wording.
    /// </param>
    /// <param name="ct">Cancellation token.</param>
    Task CreateAsync(
        Guid recipientUserId,
        NotificationType type,
        IReadOnlyDictionary<string, string>? parameters = null,
        string? variant = null,
        CancellationToken ct = default);
}
