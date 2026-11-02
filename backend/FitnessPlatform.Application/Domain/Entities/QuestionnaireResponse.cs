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
    /// The plan type the invite or request behind this response granted; null for responses assigned without one.
    /// </summary>
    public LinkCapabilityScope? Scope { get; set; }

    /// <summary>
    /// Timestamp when the response was submitted by the client.
    /// </summary>
    public DateTime? SubmittedAt { get; set; }

    /// <summary>
    /// Which kind of form this response is. Set on creation.
    /// </summary>
    public QuestionnaireResponseKind Kind { get; set; } = QuestionnaireResponseKind.Onboarding;

    /// <summary>
    /// For a check-in: the Monday of the week it covers. Null for other kinds.
    /// </summary>
    public DateOnly? CheckInWeekStart { get; set; }

    /// <summary>
    /// For a check-in: when it is due (UTC). Null for other kinds.
    /// </summary>
    public DateTime? CheckInDueAtUtc { get; set; }

    /// <summary>
    /// For a check-in: when the unanswered reminder was sent (UTC); null until it is.
    /// </summary>
    public DateTime? CheckInReminderSentAtUtc { get; set; }

    /// <summary>
    /// For a check-in: when the coach was told the week was missed (UTC); null until then.
    /// </summary>
    public DateTime? CheckInMissedNotifiedAtUtc { get; set; }

    /// <summary>
    /// When the coach first opened the submitted response (UTC); null while it is still new.
    /// </summary>
    public DateTime? ReviewedByCoachAtUtc { get; set; }

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
