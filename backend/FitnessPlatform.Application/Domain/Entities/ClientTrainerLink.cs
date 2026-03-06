using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Represents a many-to-many relationship between a client and a trainer/nutritionist.
/// A single client can have multiple trainers (e.g., one fitness trainer and one nutritionist).
/// </summary>
public class ClientTrainerLink : PublicTimestampableEntity
{
    /// <summary>
    /// Foreign key to the <see cref="ClientProfile"/>.
    /// </summary>
    public long ClientProfileId { get; set; }

    /// <summary>
    /// Foreign key to the <see cref="TrainerProfile"/>.
    /// </summary>
    public long TrainerProfileId { get; set; }

    /// <summary>
    /// The role of the trainer in this relationship (Trainer or Nutritionist).
    /// </summary>
    public UserRole TrainerRole { get; set; }

    /// <summary>
    /// Indicates whether this trainer-client relationship is currently active.
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Navigation property to the client profile.
    /// </summary>
    public ClientProfile ClientProfile { get; set; } = null!;

    /// <summary>
    /// Navigation property to the trainer profile.
    /// </summary>
    public TrainerProfile TrainerProfile { get; set; } = null!;
}
