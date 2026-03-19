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
    /// </summary>
    [MaxLength(100)]
    public string? Specialization { get; set; }

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
}
