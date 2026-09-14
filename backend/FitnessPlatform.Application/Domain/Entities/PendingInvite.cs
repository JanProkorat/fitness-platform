using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Enums;

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
    /// Optional introduction message from the professional.
    /// </summary>
    [MaxLength(500)]
    public string? Message { get; set; }

    /// <summary>
    /// Date and time when the invitation was sent.
    /// </summary>
    public DateTime SentAt { get; set; }

    /// <summary>
    /// Indicates whether this invitation has been accepted by the recipient.
    /// </summary>
    public bool IsAccepted { get; set; }

    /// <summary>
    /// Optional questionnaire to assign to the client when they accept.
    /// </summary>
    public long? QuestionnaireId { get; set; }

    /// <summary>
    /// Optional explicit domain scope the professional selected when sending this
    /// invitation. When null, the accept flow defaults to every domain implied by the
    /// professional's held identity roles at accept time — existing behavior, unchanged
    /// for invites created before this field existed and for anyone who does not
    /// explicitly opt into scoping.
    /// </summary>
    public LinkCapabilityScope? RequestedScope { get; set; }

    /// <summary>
    /// Navigation property to the assigned questionnaire.
    /// </summary>
    public Questionnaire? Questionnaire { get; set; }

    /// <summary>
    /// Navigation property to the professional who sent this invitation.
    /// </summary>
    public ProfessionalProfile ProfessionalProfile { get; set; } = null!;
}
