using FitnessPlatform.Application.Features.Users.Shared;

namespace FitnessPlatform.Application.Features.Users.GetMyCoachRoles;

/// <summary>
/// The caller's active coach roles with client counts.
/// </summary>
public class GetMyCoachRolesResponse
{
    /// <summary>One entry per active coach role.</summary>
    public List<CoachRoleSummaryDto> Roles { get; set; } = [];

    /// <summary>When a pending disable takes effect (UTC); null when the account is not being disabled.</summary>
    public DateTime? CoachAccountActiveUntil { get; set; }

    /// <summary>When the account would stop being active if disabled now (UTC); at or before now means at once.</summary>
    public DateTime? ActiveUntilIfDisabled { get; set; }
}
