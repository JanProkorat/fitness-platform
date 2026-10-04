using FitnessPlatform.Application.Domain.Common;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Assigns a <see cref="ClientTag"/> to a specific <see cref="ClientProfessionalLink"/>, so a tag
/// owned by one coach never appears on the client view belonging to a different coach sharing the
/// same client.
/// </summary>
public class ClientTagAssignment : TimestampableEntity
{
    /// <summary>
    /// Foreign key to the assigned <see cref="ClientTag"/>.
    /// </summary>
    public long ClientTagId { get; set; }

    /// <summary>
    /// Foreign key to the <see cref="ClientProfessionalLink"/> this tag is assigned to.
    /// </summary>
    public long ClientProfessionalLinkId { get; set; }

    /// <summary>
    /// Navigation property to the assigned tag.
    /// </summary>
    public ClientTag ClientTag { get; set; } = null!;

    /// <summary>
    /// Navigation property to the client-professional link.
    /// </summary>
    public ClientProfessionalLink ClientProfessionalLink { get; set; } = null!;
}
