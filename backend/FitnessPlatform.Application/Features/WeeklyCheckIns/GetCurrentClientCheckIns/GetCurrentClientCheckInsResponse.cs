namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetCurrentClientCheckIns;

/// <summary>
/// Response for GET /client/weekly-check-ins/current.
/// Returns 0–2 active check-ins (not responded, not dismissed, not expired, still within
/// the response deadline) — at most one per profession. If more than one active check-in
/// exists for the same profession, only the one with the newest <c>SentAt</c> is returned.
/// </summary>
public class GetCurrentClientCheckInsResponse
{
    /// <summary>Active check-ins, at most one per profession, ordered alphabetically by profession.</summary>
    public List<CheckInSummary> CheckIns { get; set; } = [];
}

/// <summary>Summary of a single active check-in.</summary>
public class CheckInSummary
{
    /// <summary>Check-in identifier.</summary>
    public Guid Id { get; set; }

    /// <summary>Professional who sent the check-in.</summary>
    public Guid ProfessionalUserId { get; set; }

    /// <summary>Professional's display name.</summary>
    public string ProfessionalName { get; set; } = string.Empty;

    /// <summary>Profession type (Training or Nutrition).</summary>
    public string Profession { get; set; } = string.Empty;

    /// <summary>ISO-week Monday being planned.</summary>
    public DateOnly WeekStartDate { get; set; }

    /// <summary>When the scheduler sent this check-in.</summary>
    public DateTime SentAt { get; set; }
}
