namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetCurrentClientCheckIns;

/// <summary>
/// Response for GET /client/weekly-check-ins/current.
/// Returns 0–2 active (not responded, not dismissed) check-ins for the current ISO week.
/// </summary>
public class GetCurrentClientCheckInsResponse
{
    /// <summary>Active check-ins for the current ISO week.</summary>
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
