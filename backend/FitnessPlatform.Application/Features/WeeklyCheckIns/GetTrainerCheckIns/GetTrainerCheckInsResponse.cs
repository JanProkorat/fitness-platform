using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetTrainerCheckIns;

/// <summary>
/// Response for GET /trainer/weekly-check-ins.
/// </summary>
public class GetTrainerCheckInsResponse
{
    /// <summary>Check-ins for the requested week, filtered to the caller's clients.</summary>
    public List<TrainerCheckInDto> CheckIns { get; set; } = [];
}

/// <summary>One check-in row as seen by the trainer.</summary>
public class TrainerCheckInDto
{
    /// <summary>Check-in identifier.</summary>
    public Guid Id { get; set; }

    /// <summary>Client's ApplicationUser.Id.</summary>
    public Guid ClientUserId { get; set; }

    /// <summary>Client's display name.</summary>
    public string ClientName { get; set; } = string.Empty;

    /// <summary>Profession context.</summary>
    public string Profession { get; set; } = string.Empty;

    /// <summary>ISO-week Monday.</summary>
    public DateOnly WeekStartDate { get; set; }

    /// <summary>Flags selected by the client. Empty until responded.</summary>
    public List<CheckInFlag> Flags { get; set; } = [];

    /// <summary>Client's note. Null until responded.</summary>
    public string? Note { get; set; }

    /// <summary>When the scheduler sent this check-in.</summary>
    public DateTime SentAt { get; set; }

    /// <summary>When the client responded. Null if not yet responded.</summary>
    public DateTime? RespondedAt { get; set; }

    /// <summary>When the client dismissed. Null if not dismissed.</summary>
    public DateTime? DismissedByClientAt { get; set; }

    /// <summary>When the trainer marked this reviewed. Null if not reviewed.</summary>
    public DateTime? ReviewedByTrainerAt { get; set; }
}
