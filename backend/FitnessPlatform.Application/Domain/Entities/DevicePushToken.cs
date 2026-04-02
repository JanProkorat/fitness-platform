using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Stores an Expo push token for a user's device so the server can send push notifications.
/// </summary>
public class DevicePushToken : TimestampableEntity
{
    /// <summary>
    /// The user this token belongs to.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// The Expo push token string (e.g. "ExponentPushToken[...]").
    /// </summary>
    [MaxLength(256)]
    public string Token { get; set; } = string.Empty;

    /// <summary>
    /// Platform: "ios" or "android".
    /// </summary>
    [MaxLength(20)]
    public string Platform { get; set; } = string.Empty;

    /// <summary>
    /// Navigation property to the user.
    /// </summary>
    public ApplicationUser User { get; set; } = null!;
}
