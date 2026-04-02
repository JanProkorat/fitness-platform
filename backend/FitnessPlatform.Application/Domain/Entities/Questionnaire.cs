using System.ComponentModel.DataAnnotations;
using FitnessPlatform.Application.Domain.Common;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// A questionnaire template created by a professional for client onboarding.
/// A professional can have multiple questionnaires, with one marked as default.
/// </summary>
public class Questionnaire : PublicTimestampableEntity
{
    /// <summary>
    /// Foreign key to the professional (ApplicationUser) who owns this questionnaire.
    /// </summary>
    public Guid ProfessionalId { get; set; }

    /// <summary>
    /// Title of the questionnaire.
    /// </summary>
    [MaxLength(200)]
    public string Title { get; set; } = null!;

    /// <summary>
    /// Optional description of the questionnaire.
    /// </summary>
    [MaxLength(1000)]
    public string? Description { get; set; }

    /// <summary>
    /// Whether the questionnaire is active and can be sent to clients.
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Whether this is the default questionnaire auto-sent to new clients.
    /// </summary>
    public bool IsDefault { get; set; }

    /// <summary>
    /// Navigation property to the professional user.
    /// </summary>
    public ApplicationUser Professional { get; set; } = null!;

    /// <summary>
    /// Collection of questions belonging to this questionnaire.
    /// </summary>
    public ICollection<QuestionnaireQuestion> Questions { get; set; } = [];
}
