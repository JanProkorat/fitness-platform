using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Represents a pending invitation sent by a professional to a prospective client.
/// Tracks whether the invitation has been accepted.
/// </summary>
public class PendingInvite : PublicTimestampableEntity
{
    /// <summary>
    /// Foreign key to the <see cref="ProfessionalProfile"/> who sent the invitation.
    /// </summary>
    public long ProfessionalProfileId { get; set; }

    /// <summary>
    /// First name of the invited person.
    /// </summary>
    [MaxLength(100)]
    public string FirstName { get; set; } = string.Empty;

    /// <summary>
    /// Last name of the invited person.
    /// </summary>
    [MaxLength(100)]
    public string LastName { get; set; } = string.Empty;

    /// <summary>
    /// Email address of the invited person.
    /// </summary>
    [MaxLength(256)]
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// Date and time when the invitation was sent.
    /// </summary>
    public DateTime SentAt { get; set; }

    /// <summary>
    /// Indicates whether this invitation has been accepted by the recipient.
    /// </summary>
    public bool IsAccepted { get; set; }

    /// <summary>
    /// Navigation property to the professional who sent this invitation.
    /// </summary>
    public ProfessionalProfile ProfessionalProfile { get; set; } = null!;
}
