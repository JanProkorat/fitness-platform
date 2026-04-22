using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Application user extending ASP.NET Identity with fitness platform specific properties.
/// </summary>
public class ApplicationUser : IdentityUser<Guid>
{
    /// <summary>
    /// User's first name.
    /// </summary>
    [MaxLength(50)]
    public string FirstName { get; set; } = string.Empty;

    /// <summary>
    /// User's last name.
    /// </summary>
    [MaxLength(50)]
    public string LastName { get; set; } = string.Empty;

    /// <summary>
    /// Date and time when the user account was created.
    /// </summary>
    public DateTime DateCreated { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Date and time when the user account was last updated.
    /// </summary>
    public DateTime? DateUpdated { get; set; }

    /// <summary>
    /// Indicates whether the user account is active.
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Indicates whether the user has given GDPR consent for health data processing.
    /// </summary>
    public bool GdprConsent { get; set; }

    /// <summary>
    /// Date and time when the user gave GDPR consent.
    /// </summary>
    public DateTime? GdprConsentDate { get; set; }

    /// <summary>
    /// Navigation property to the user's professional profile (if the user is a trainer or nutritionist).
    /// </summary>
    public ProfessionalProfile? ProfessionalProfile { get; set; }

    /// <summary>
    /// Navigation property to the user's client profile (if the user is a client).
    /// </summary>
    public ClientProfile? ClientProfile { get; set; }

    /// <summary>
    /// Number of verification emails sent to this user (including the original). Max 4.
    /// </summary>
    public int VerificationEmailsSent { get; set; }

    /// <summary>
    /// User's IANA time zone identifier (e.g. "Europe/Prague"). Defaults to "Europe/Prague".
    /// </summary>
    [MaxLength(100)]
    public string TimeZone { get; set; } = "Europe/Prague";

    /// <summary>
    /// URL of the user's avatar blob in storage (null if no avatar has been set).
    /// </summary>
    [MaxLength(500)]
    public string? AvatarBlobUrl { get; set; }

    /// <summary>
    /// Collection of refresh tokens issued to this user.
    /// </summary>
    public ICollection<RefreshToken> RefreshTokens { get; set; } = [];
}
