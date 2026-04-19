using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.RespondToCheckIn;

/// <summary>
/// Response for POST /client/weekly-check-ins/{id}/respond.
/// </summary>
public class RespondToCheckInResponse
{
    /// <summary>Check-in identifier.</summary>
    public Guid Id { get; set; }

    /// <summary>Flags persisted.</summary>
    public List<CheckInFlag> Flags { get; set; } = [];

    /// <summary>Note persisted.</summary>
    public string? Note { get; set; }

    /// <summary>When the response was recorded (UTC).</summary>
    public DateTime RespondedAt { get; set; }
}
