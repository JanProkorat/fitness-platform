using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// Represents a many-to-many relationship between a client and a professional (trainer or nutritionist).
/// A single client can have multiple professionals (e.g., one fitness trainer and one nutritionist).
/// </summary>
public class ClientProfessionalLink : PublicTimestampableEntity
{
    /// <summary>
    /// Foreign key to the <see cref="ClientProfile"/>.
    /// </summary>
    public long ClientProfileId { get; set; }

    /// <summary>
    /// Foreign key to the <see cref="ProfessionalProfile"/>.
    /// </summary>
    public long ProfessionalProfileId { get; set; }

    /// <summary>
    /// The role of the professional in this relationship (Trainer or Nutritionist).
    /// </summary>
    public UserRole ProfessionalRole { get; set; }

    /// <summary>
    /// Indicates whether this professional-client relationship is currently active.
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Whether this professional can view the client's nutrition plans.
    /// Default true for Nutritionists, false for Trainers.
    /// </summary>
    public bool CanViewNutritionPlans { get; set; }

    /// <summary>
    /// Whether this professional can view the client's training plans.
    /// Default true for Trainers, false for Nutritionists.
    /// </summary>
    public bool CanViewTrainingPlans { get; set; }

    /// <summary>
    /// Optional override: specific questionnaire assigned to this client. If null, the professional's default questionnaire is used.
    /// </summary>
    public long? QuestionnaireId { get; set; }

    /// <summary>
    /// Navigation property to the assigned questionnaire.
    /// </summary>
    public Questionnaire? Questionnaire { get; set; }

    /// <summary>
    /// Navigation property to the client profile.
    /// </summary>
    public ClientProfile ClientProfile { get; set; } = null!;

    /// <summary>
    /// Navigation property to the professional profile.
    /// </summary>
    public ProfessionalProfile ProfessionalProfile { get; set; } = null!;
}
