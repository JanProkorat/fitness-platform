using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// A client's response to a questionnaire, containing all their answers.
/// </summary>
public class QuestionnaireResponse : PublicTimestampableEntity
{
    /// <summary>
    /// Foreign key to the questionnaire being responded to.
    /// </summary>
    public long QuestionnaireId { get; set; }

    /// <summary>
    /// Foreign key to the client (ApplicationUser) filling out the questionnaire.
    /// </summary>
    public Guid ClientId { get; set; }

    /// <summary>
    /// Foreign key to the professional (ApplicationUser) who sent the questionnaire.
    /// </summary>
    public Guid ProfessionalId { get; set; }

    /// <summary>
    /// Foreign key to the client-professional link.
    /// </summary>
    public long LinkId { get; set; }

    /// <summary>
    /// Current status of the response.
    /// </summary>
    public QuestionnaireResponseStatus Status { get; set; } = QuestionnaireResponseStatus.Pending;

    /// <summary>
    /// Timestamp when the response was submitted by the client.
    /// </summary>
    public DateTime? SubmittedAt { get; set; }

    /// <summary>
    /// Navigation property to the questionnaire.
    /// </summary>
    public Questionnaire Questionnaire { get; set; } = null!;

    /// <summary>
    /// Navigation property to the client-professional link.
    /// </summary>
    public ClientProfessionalLink Link { get; set; } = null!;

    /// <summary>
    /// Collection of individual answers in this response.
    /// </summary>
    public ICollection<QuestionnaireAnswer> Answers { get; set; } = [];
}
