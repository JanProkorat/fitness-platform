namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetMyCheckInHistory;

/// <summary>
/// One page of the caller's own weekly check-in history, newest first.
/// </summary>
public class GetMyCheckInHistoryResponse
{
    /// <summary>Check-ins on the requested page.</summary>
    public List<MyCheckInHistoryItem> Items { get; set; } = [];
}

/// <summary>
/// One check-in in the caller's history. Carries no client answers (flags, note, hunger score).
/// </summary>
public class MyCheckInHistoryItem
{
    /// <summary>Check-in id.</summary>
    public Guid Id { get; set; }

    /// <summary>User id of the professional who sent the check-in.</summary>
    public Guid ProfessionalUserId { get; set; }

    /// <summary>Display name of the professional.</summary>
    public string ProfessionalName { get; set; } = string.Empty;

    /// <summary>Profession the check-in applies to (Training or Nutrition).</summary>
    public string Profession { get; set; } = string.Empty;

    /// <summary>ISO-week Monday of the week being planned.</summary>
    public DateOnly WeekStartDate { get; set; }

    /// <summary>UTC time the check-in was sent.</summary>
    public DateTime SentAt { get; set; }

    /// <summary>Lifecycle status (Pending, Responded, Dismissed, Reviewed, Expired).</summary>
    public string Status { get; set; } = string.Empty;

    /// <summary>UTC time the client responded; null when not responded.</summary>
    public DateTime? RespondedAt { get; set; }

    /// <summary>UTC time the client dismissed the check-in; null when not dismissed.</summary>
    public DateTime? DismissedAt { get; set; }

    /// <summary>UTC time the check-in expired unanswered; null when not expired.</summary>
    public DateTime? ExpiredAt { get; set; }

    /// <summary>UTC response deadline; null for legacy rows without one.</summary>
    public DateTime? DueAt { get; set; }

    /// <summary>UTC time the professional marked the check-in reviewed; null when not reviewed.</summary>
    public DateTime? ReviewedAt { get; set; }
}
