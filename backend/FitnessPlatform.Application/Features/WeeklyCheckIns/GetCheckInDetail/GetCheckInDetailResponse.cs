using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetCheckInDetail;


/// <summary>
/// Response for GET /trainer/weekly-check-ins/{id}.
/// </summary>
public class GetCheckInDetailResponse
{
    /// <summary>Check-in identifier.</summary>
    public Guid Id { get; set; }

    /// <summary>Client's ApplicationUser.Id.</summary>
    public Guid ClientUserId { get; set; }

    /// <summary>Client's display name.</summary>
    public string ClientName { get; set; } = string.Empty;

    /// <summary>Professional's ApplicationUser.Id.</summary>
    public Guid ProfessionalUserId { get; set; }

    /// <summary>Profession context.</summary>
    public string Profession { get; set; } = string.Empty;

    /// <summary>ISO-week Monday being planned.</summary>
    public DateOnly WeekStartDate { get; set; }

    /// <summary>Flags selected by the client.</summary>
    public List<CheckInFlag> Flags { get; set; } = [];

    /// <summary>Client's optional note.</summary>
    public string? Note { get; set; }

    /// <summary>When the scheduler sent this check-in.</summary>
    public DateTime SentAt { get; set; }

    /// <summary>When the client responded. Null if not yet responded.</summary>
    public DateTime? RespondedAt { get; set; }

    /// <summary>When the client dismissed. Null if not dismissed.</summary>
    public DateTime? DismissedByClientAt { get; set; }

    /// <summary>When the trainer marked this reviewed. Null if not reviewed.</summary>
    public DateTime? ReviewedByTrainerAt { get; set; }

    /// <summary>Lifecycle status of the check-in.</summary>
    public string Status { get; set; } = WeeklyCheckInStatus.Pending.ToString();

    /// <summary>UTC deadline by which the client must respond. Null for rows created before v1 deadline feature.</summary>
    public DateTime? DueAt { get; set; }
}
