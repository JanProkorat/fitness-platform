using FitnessPlatform.Application.Features.Users.Shared;

namespace FitnessPlatform.Application.Features.Users.RemoveCoachRole;

/// <summary>
/// Result of removing a coach role: the counts as they stood just before the removal.
/// </summary>
public class RemoveCoachRoleResponse
{
    /// <summary>The role that was removed.</summary>
    public string RemovedRole { get; set; } = string.Empty;

    /// <summary>Counts for every role that was active before the removal, including the removed one.</summary>
    public List<CoachRoleSummaryDto> Roles { get; set; } = [];
}
