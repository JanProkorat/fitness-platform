using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Represents a JWT refresh token stored in the database for token rotation.
/// </summary>
public class RefreshToken : TimestampableEntity
{
    /// <summary>
    /// Foreign key to the <see cref="ApplicationUser"/> who owns this token.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// The refresh token string value.
    /// </summary>
    [MaxLength(200)]
    public string Token { get; set; } = string.Empty;

    /// <summary>
    /// Date and time when the token expires.
    /// </summary>
    public DateTime ExpiresAt { get; set; }

    /// <summary>
    /// Date and time when the token was revoked, or <c>null</c> if still valid.
    /// </summary>
    public DateTime? RevokedAt { get; set; }

    /// <summary>
    /// The token that replaced this one after rotation, if applicable.
    /// </summary>
    [MaxLength(200)]
    public string? ReplacedByToken { get; set; }

    /// <summary>
    /// Indicates whether this token has been revoked.
    /// </summary>
    public bool IsRevoked => RevokedAt is not null;

    /// <summary>
    /// Indicates whether this token has expired.
    /// </summary>
    public bool IsExpired => DateTime.UtcNow >= ExpiresAt;

    /// <summary>
    /// Indicates whether this token is currently usable (not revoked and not expired).
    /// </summary>
    public bool IsActive => !IsRevoked && !IsExpired;

    /// <summary>
    /// Navigation property to the user who owns this token.
    /// </summary>
    public ApplicationUser User { get; set; } = null!;
}
