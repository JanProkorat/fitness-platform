namespace FitnessPlatform.Application.Features.PhotoDiaryRequests;

// ── Payload classes for diary-lifecycle SignalR events ──────────────────────
//
// Routing summary:
//   photoDiaryRequested    → client group  (identified by clientUserId)
//   photoDiaryDismissed    → trainer/nutritionist group (request.ProfessionalId)
//   photoDiaryPhotoUploaded → trainer/nutritionist group (request.ProfessionalId)
//   photoDiarySubmitted    → trainer/nutritionist group (request.ProfessionalId)
//
// Groups are per-user: each user has their own SignalR group named by userId.ToString().
// This gives a natural "client group" vs "nutritionist group" without extra hub machinery.

/// <summary>
/// Payload for the <c>photoDiaryRequested</c> SignalR event.
/// Emitted to the <b>client</b> when a nutritionist/trainer creates a new photo diary request.
/// </summary>
public class PhotoDiaryRequestedEvent
{
    /// <summary>Public identifier of the newly-created diary request.</summary>
    public Guid RequestId { get; init; }

    /// <summary>Display name of the requesting professional.</summary>
    public string ProfessionalName { get; init; } = string.Empty;

    /// <summary>Role of the requesting professional (e.g. "Nutritionist", "Trainer").</summary>
    public string ProfessionalRole { get; init; } = string.Empty;

    /// <summary>Number of days the client has to complete the diary.</summary>
    public int DurationDays { get; init; }

    /// <summary>Optional MongoDB plan the request is scoped to.</summary>
    public Guid? PlanId { get; init; }

    /// <summary>When the request was created.</summary>
    public DateTimeOffset CreatedAt { get; init; }
}

/// <summary>
/// Payload for the <c>photoDiaryDismissed</c> SignalR event.
/// Emitted to the <b>professional</b> when the client dismisses a diary request.
/// </summary>
public class PhotoDiaryDismissedEvent
{
    /// <summary>Public identifier of the diary request.</summary>
    public Guid RequestId { get; init; }

    /// <summary>Display name of the client who dismissed.</summary>
    public string ClientName { get; init; } = string.Empty;

    /// <summary>Optional reason the client provided for dismissing.</summary>
    public string? DismissReason { get; init; }

    /// <summary>When the request was dismissed (UpdatedAt after the status transition).</summary>
    public DateTimeOffset DismissedAt { get; init; }
}

/// <summary>
/// Payload for the <c>photoDiaryPhotoUploaded</c> SignalR event.
/// Emitted to the <b>professional</b> when the client uploads a photo against an active diary request.
/// </summary>
public class PhotoDiaryPhotoUploadedEvent
{
    /// <summary>Public identifier of the diary request the photo belongs to.</summary>
    public Guid RequestId { get; init; }

    /// <summary>Public identifier of the newly-created PlanPhoto row.</summary>
    public Guid PhotoId { get; init; }

    /// <summary>Display name of the uploading client.</summary>
    public string ClientName { get; init; } = string.Empty;

    /// <summary>
    /// Day number within the diary (1-based). Computed as (UtcNow − request.AcceptedAt).Days + 1
    /// when AcceptedAt is set; falls back to 1 otherwise.
    /// </summary>
    public int DayIndex { get; init; }

    /// <summary>Optional description/caption the client attached to the photo.</summary>
    public string? Caption { get; init; }

    /// <summary>When the photo was finalized.</summary>
    public DateTimeOffset UploadedAt { get; init; }
}

/// <summary>
/// Payload for the <c>photoDiarySubmitted</c> SignalR event.
/// Emitted to the <b>professional</b> when the client submits (completes) a diary.
/// </summary>
public class PhotoDiarySubmittedEvent
{
    /// <summary>Public identifier of the diary request.</summary>
    public Guid RequestId { get; init; }

    /// <summary>Display name of the client who submitted.</summary>
    public string ClientName { get; init; } = string.Empty;

    /// <summary>Total number of PlanPhoto rows linked to this diary request at submission time.</summary>
    public int PhotoCount { get; init; }

    /// <summary>When the diary was submitted (CompletedAt after the status transition).</summary>
    public DateTimeOffset SubmittedAt { get; init; }
}
