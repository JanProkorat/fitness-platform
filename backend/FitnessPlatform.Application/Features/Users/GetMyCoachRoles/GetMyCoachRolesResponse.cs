using FitnessPlatform.Application.Features.Users.Shared;

namespace FitnessPlatform.Application.Features.Users.GetMyCoachRoles;

/// <summary>
/// The caller's active coach roles with client counts.
/// </summary>
public class GetMyCoachRolesResponse
{
    /// <summary>One entry per active coach role.</summary>
    public List<CoachRoleSummaryDto> Roles { get; set; } = [];
}
