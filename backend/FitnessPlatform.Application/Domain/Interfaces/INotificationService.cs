using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Service for creating notifications in the database.
/// </summary>
public interface INotificationService
{
    /// <summary>
    /// Creates a notification for the specified user.
    /// </summary>
    /// <param name="recipientUserId">The recipient's ApplicationUser.Id.</param>
    /// <param name="type">Type of notification.</param>
    /// <param name="title">Notification title.</param>
    /// <param name="body">Notification body text.</param>
    /// <param name="data">Optional JSON payload.</param>
    /// <param name="ct">Cancellation token.</param>
    Task CreateAsync(Guid recipientUserId, NotificationType type, string title, string body, string? data = null, CancellationToken ct = default);
}
