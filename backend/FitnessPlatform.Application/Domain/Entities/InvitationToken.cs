using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Represents a one-time invitation token sent by a trainer to a client via email.
/// Tokens expire after 7 days and can only be used once.
/// </summary>
public class InvitationToken : TimestampableEntity
{
    /// <summary>
    /// Foreign key to the <see cref="ProfessionalProfile"/> who sent the invitation.
    /// </summary>
    public long ProfessionalProfileId { get; set; }

    /// <summary>
    /// Email address of the invited client.
    /// </summary>
    [MaxLength(100)]
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// The unique invitation token string.
    /// </summary>
    [MaxLength(100)]
    public string Token { get; set; } = string.Empty;

    /// <summary>
    /// Date and time when the invitation expires.
    /// </summary>
    public DateTime ExpiresAt { get; set; }

    /// <summary>
    /// Indicates whether this invitation has already been accepted.
    /// </summary>
    public bool IsUsed { get; set; }

    /// <summary>
    /// Navigation property to the professional who sent this invitation.
    /// </summary>
    public ProfessionalProfile ProfessionalProfile { get; set; } = null!;
}
