using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.RespondToCheckIn;

/// <summary>
/// Request body for POST /client/weekly-check-ins/{id}/respond.
/// </summary>
public class RespondToCheckInRequest
{
    /// <summary>Route parameter — check-in identifier.</summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Zero or more flags selected by the client.
    /// </summary>
    public List<CheckInFlag> Flags { get; set; } = [];

    /// <summary>
    /// Optional free-text note. ≤ 500 characters.
    /// </summary>
    public string? Note { get; set; }
}
