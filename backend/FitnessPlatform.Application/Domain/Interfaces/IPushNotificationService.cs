namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Sends push notifications to user devices via Expo Push API.
/// </summary>
public interface IPushNotificationService
{
    /// <summary>
    /// Sends a push notification to all devices registered for the given user.
    /// </summary>
    Task SendAsync(Guid userId, string title, string body, object? data = null, CancellationToken ct = default);
}
