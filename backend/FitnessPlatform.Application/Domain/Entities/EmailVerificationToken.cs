using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Represents an email verification token sent to a user.
/// Tokens have an expiration date and can only be used once.
/// </summary>
public class EmailVerificationToken : TimestampableEntity
{
    /// <summary>
    /// Foreign key to the <see cref="ApplicationUser"/> who owns this token.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// The unique verification token string.
    /// </summary>
    [MaxLength(128)]
    public string Token { get; set; } = string.Empty;

    /// <summary>
    /// Date and time when the token expires.
    /// </summary>
    public DateTime ExpiresAt { get; set; }

    /// <summary>
    /// Date and time when the token was used. Null if not yet used.
    /// </summary>
    public DateTime? UsedAt { get; set; }

    /// <summary>
    /// Navigation property to the user who owns this token.
    /// </summary>
    public ApplicationUser User { get; set; } = null!;
}
