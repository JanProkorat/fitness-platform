using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.GetClientCurrentCheckIn;

/// <summary>
/// Response for GET /trainer/clients/{clientUserId}/weekly-check-ins/current.
/// </summary>
public class GetClientCurrentCheckInResponse
{
    /// <summary>
    /// Latest check-in(s) for the current ISO week and the given client.
    /// Typically 0–2 items (one per profession).
    /// </summary>
    public List<ClientCheckInDto> CheckIns { get; set; } = [];
}

/// <summary>A single check-in as seen from the plan-editor banner.</summary>
public class ClientCheckInDto
{
    /// <summary>Check-in identifier.</summary>
    public Guid Id { get; set; }

    /// <summary>Profession context.</summary>
    public string Profession { get; set; } = string.Empty;

    /// <summary>ISO-week Monday.</summary>
    public DateOnly WeekStartDate { get; set; }

    /// <summary>Flags selected by the client.</summary>
    public List<CheckInFlag> Flags { get; set; } = [];

    /// <summary>Client's note.</summary>
    public string? Note { get; set; }

    /// <summary>When the scheduler sent this.</summary>
    public DateTime SentAt { get; set; }

    /// <summary>When the client responded. Null if pending.</summary>
    public DateTime? RespondedAt { get; set; }

    /// <summary>When the client dismissed. Null if not dismissed.</summary>
    public DateTime? DismissedByClientAt { get; set; }

    /// <summary>When the trainer marked this reviewed.</summary>
    public DateTime? ReviewedByTrainerAt { get; set; }
}
