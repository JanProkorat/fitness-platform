using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Questionnaires.GetClientPendingQuestionnaires;

/// <summary>
/// Combined banner response. Diary requests come first (ordering convention documented
/// on the endpoint summary); questionnaires second.
/// </summary>
public class GetClientPendingQuestionnairesResponse
{
    /// <summary>
    /// Pending photo-diary requests addressed to this client.
    /// Always populated before <see cref="Items"/> so the mobile banner stack
    /// renders diary banners above questionnaire banners.
    /// </summary>
    public List<PendingDiaryRequestItem> PendingDiaryRequests { get; set; } = [];

    /// <summary>
    /// Pending / in-progress questionnaires for this client: one per open response, or one per active link
    /// that has none yet.
    /// </summary>
    public List<PendingQuestionnaireItem> Items { get; set; } = [];
}

/// <summary>
/// Banner DTO for a single pending photo-diary request.
/// Shape mirrors <see cref="PendingQuestionnaireItem"/> so the mobile banner component
/// can render both types with a single rendering pattern.
/// </summary>
public class PendingDiaryRequestItem
{
    /// <summary>Public identifier of the diary request (same as <c>PhotoDiaryRequest.Id</c>).</summary>
    public Guid RequestPublicId { get; set; }

    /// <summary>Display name of the professional who sent the request.</summary>
    public string ProfessionalName { get; set; } = string.Empty;

    /// <summary>Role of the professional ("Trainer" or "Nutritionist").</summary>
    public string? ProfessionalRole { get; set; }

    /// <summary>How many days the request stays open (default 7).</summary>
    public int DurationDays { get; set; }

    /// <summary>The upload mode the coach chose; null on legacy rows.</summary>
    public PhotoDiaryMode? Mode { get; set; }

    /// <summary>The coach's optional note to the client.</summary>
    public string? Message { get; set; }

    /// <summary>Always "Pending" for items returned by this endpoint.</summary>
    public string Status { get; set; } = "Pending";

    /// <summary>
    /// Optional MongoDB plan ID the diary request is scoped to.
    /// Null when the request has no plan context.
    /// </summary>
    public Guid? PlanId { get; set; }

    /// <summary>When the request was created (UTC).</summary>
    public DateTimeOffset CreatedAt { get; set; }
}

public class PendingQuestionnaireItem
{
    public Guid LinkPublicId { get; set; }
    public string ProfessionalName { get; set; } = string.Empty;
    public string? ProfessionalRole { get; set; }
    public Guid? QuestionnairePublicId { get; set; }
    public string? QuestionnaireTitle { get; set; }
    /// <summary>Questions the client answers in the app: not hidden, not a heading, not a file upload.</summary>
    public int QuestionCount { get; set; }

    /// <summary>
    /// When the questionnaire was sent (UTC): response creation time, else link activation time,
    /// else link creation time.
    /// </summary>
    public DateTime SentAt { get; set; }

    public Guid? ResponsePublicId { get; set; }
    public string? ResponseStatus { get; set; }

    /// <summary>Plan type the response was sent for; null for the link-level fallback item.</summary>
    public LinkCapabilityScope? Scope { get; set; }
}
