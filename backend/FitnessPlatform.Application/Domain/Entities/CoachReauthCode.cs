using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// An emailed one-time code that re-authenticates a coach who has no password (social sign-in)
/// before a bank account change.
/// </summary>
public class CoachReauthCode : TimestampableEntity
{
    /// <summary>
    /// Foreign key to the <see cref="ApplicationUser"/> the code was sent to.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// SHA-256 hex hash of the code, salted with the user id.
    /// </summary>
    [MaxLength(64)]
    public string CodeHash { get; set; } = string.Empty;

    /// <summary>
    /// When the code stops working (UTC).
    /// </summary>
    public DateTime ExpiresAt { get; set; }

    /// <summary>
    /// When the code was used or replaced by a newer one (UTC). Null while it is still valid.
    /// </summary>
    public DateTime? UsedAt { get; set; }

    /// <summary>
    /// Number of wrong codes submitted while this code was active.
    /// </summary>
    public int FailedAttempts { get; set; }

    /// <summary>
    /// Navigation property to the user the code was sent to.
    /// </summary>
    public ApplicationUser User { get; set; } = null!;
}
