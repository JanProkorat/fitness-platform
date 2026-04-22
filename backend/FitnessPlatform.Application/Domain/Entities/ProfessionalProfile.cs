using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Profile information for users in the Trainer or Nutritionist role.
/// </summary>
public class ProfessionalProfile : PublicTimestampableEntity
{
    /// <summary>
    /// Foreign key to the associated <see cref="ApplicationUser"/>.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Short biography or description of the professional.
    /// </summary>
    [MaxLength(1000)]
    public string? Bio { get; set; }

    /// <summary>
    /// Area of specialization (e.g., strength training, yoga, nutrition).
    /// Kept for backwards compatibility. New code should prefer Specializations (JSON array).
    /// </summary>
    [MaxLength(100)]
    public string? Specialization { get; set; }

    /// <summary>
    /// City where the professional is based.
    /// </summary>
    [MaxLength(100)]
    public string? City { get; set; }

    /// <summary>
    /// Estimated price per month (free-text, e.g. "3 500 Kč").
    /// </summary>
    [MaxLength(100)]
    public string? EstimatedPrice { get; set; }

    /// <summary>
    /// Specializations stored as JSON array (e.g. ["Silový trénink","Výživa"]).
    /// </summary>
    public string? Specializations { get; set; }

    /// <summary>
    /// Certificates and education stored as JSON array.
    /// </summary>
    public string? Certificates { get; set; }

    /// <summary>
    /// Spoken languages stored as JSON array.
    /// </summary>
    public string? Languages { get; set; }

    /// <summary>
    /// Collaboration type: "both", "online", or "inperson".
    /// </summary>
    [MaxLength(20)]
    public string? CollaborationType { get; set; }

    /// <summary>
    /// Maximum number of clients the professional can handle.
    /// </summary>
    public int? MaxClients { get; set; }

    /// <summary>
    /// LinkedIn profile URL or handle.
    /// </summary>
    [MaxLength(200)]
    public string? LinkedIn { get; set; }

    /// <summary>
    /// Instagram handle.
    /// </summary>
    [MaxLength(200)]
    public string? Instagram { get; set; }

    /// <summary>
    /// Website URL.
    /// </summary>
    [MaxLength(200)]
    public string? Website { get; set; }

    /// <summary>
    /// Whether the profile is visible in the marketplace search.
    /// </summary>
    public bool ShowInSearch { get; set; } = true;

    /// <summary>
    /// Whether the professional is currently accepting new clients.
    /// </summary>
    public bool AcceptNewClients { get; set; } = true;

    /// <summary>
    /// Blob URL for the professional's avatar image (e.g. "avatars/prof-{id}.jpg").
    /// Null when no avatar has been uploaded.
    /// </summary>
    [MaxLength(500)]
    public string? AvatarBlobUrl { get; set; }

    /// <summary>
    /// Navigation property to the associated user.
    /// </summary>
    public ApplicationUser User { get; set; } = null!;

    /// <summary>
    /// Collection of links to clients managed by this professional.
    /// </summary>
    public ICollection<ClientProfessionalLink> ClientLinks { get; set; } = [];

    /// <summary>
    /// Collection of invitation tokens sent by this professional.
    /// </summary>
    public ICollection<InvitationToken> InvitationTokens { get; set; } = [];

    /// <summary>
    /// Collection of pending invites sent by this professional.
    /// </summary>
    public ICollection<PendingInvite> PendingInvites { get; set; } = [];
}
