using System.ComponentModel.DataAnnotations;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Stores an external OAuth provider identity linked to an application user.
/// Used to support social login flows (Google, Apple, etc.).
/// </summary>
public class UserExternalLogin
{
    /// <summary>
    /// Primary key.
    /// </summary>
    public long Id { get; set; }

    /// <summary>
    /// The application user this external login belongs to.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Navigation property to the linked user.
    /// </summary>
    public ApplicationUser User { get; set; } = null!;

    /// <summary>
    /// The OAuth provider name (e.g. "google", "apple").
    /// </summary>
    [MaxLength(50)]
    public string Provider { get; set; } = string.Empty;

    /// <summary>
    /// The provider's unique subject identifier for this user (e.g. Google's "sub" claim).
    /// </summary>
    [MaxLength(255)]
    public string Subject { get; set; } = string.Empty;

    /// <summary>
    /// UTC timestamp when this external login was created.
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
