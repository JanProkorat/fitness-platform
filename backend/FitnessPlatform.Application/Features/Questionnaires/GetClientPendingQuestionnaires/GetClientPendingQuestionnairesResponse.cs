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
    /// Pending / in-progress questionnaires for this client (one per active professional link).
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

    /// <summary>How many days the client has to upload photos (default 7).</summary>
    public int DurationDays { get; set; }

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
    public int QuestionCount { get; set; }
    public Guid? ResponsePublicId { get; set; }
    public string? ResponseStatus { get; set; }
}
