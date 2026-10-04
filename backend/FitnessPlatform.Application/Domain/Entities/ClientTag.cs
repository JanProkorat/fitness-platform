using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// A coach-owned label a professional can attach to their clients. Ownership is scoped to the
/// <see cref="ProfessionalProfile"/> that created it — tags never leak between coaches sharing the
/// same client, because assignment is scoped to the <see cref="ClientProfessionalLink"/>
/// (see <see cref="ClientTagAssignment"/>), not the client itself.
/// </summary>
public class ClientTag : PublicTimestampableEntity
{
    /// <summary>
    /// Foreign key to the owning <see cref="ProfessionalProfile"/>.
    /// </summary>
    public long OwnerProfessionalProfileId { get; set; }

    /// <summary>
    /// Tag label. Unique per owner.
    /// </summary>
    [MaxLength(50)]
    public required string Name { get; set; }

    /// <summary>
    /// Optional free-text description.
    /// </summary>
    [MaxLength(500)]
    public string? Description { get; set; }

    /// <summary>
    /// Display color as a lowercase 6-digit hex string, e.g. <c>"#3b82f6"</c>.
    /// </summary>
    [MaxLength(7)]
    public required string ColorHex { get; set; }

    /// <summary>
    /// Navigation property to the owning professional profile.
    /// </summary>
    public ProfessionalProfile OwnerProfessionalProfile { get; set; } = null!;

    /// <summary>
    /// Assignments of this tag to specific client links.
    /// </summary>
    public ICollection<ClientTagAssignment> Assignments { get; set; } = [];
}
