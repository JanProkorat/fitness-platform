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
    public DateTime SentAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Stored lifecycle state. Expiry is derived on read, never stored here.
    /// </summary>
    public PendingInviteStatus Status { get; set; } = PendingInviteStatus.Pending;

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
    /// Optional package the client is assigned when they accept; null for an invite without terms.
    /// </summary>
    public long? CoachPackageId { get; set; }

    /// <summary>
    /// Optional discount applied to <see cref="CoachPackageId"/>; never set without a package.
    /// </summary>
    public long? CoachDiscountId { get; set; }

    /// <summary>
    /// Navigation property to the package offered with the invite.
    /// </summary>
    public CoachPackage? CoachPackage { get; set; }

    /// <summary>
    /// Navigation property to the discount offered with the invite.
    /// </summary>
    public CoachDiscount? CoachDiscount { get; set; }

    /// <summary>
    /// Navigation property to the assigned questionnaire.
    /// </summary>
    public Questionnaire? Questionnaire { get; set; }

    /// <summary>
    /// Navigation property to the professional who sent this invitation.
    /// </summary>
    public ProfessionalProfile ProfessionalProfile { get; set; } = null!;
}
