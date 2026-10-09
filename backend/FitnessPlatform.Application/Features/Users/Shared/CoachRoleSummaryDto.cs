namespace FitnessPlatform.Application.Features.Users.Shared;

/// <summary>
/// One active coach role with the client counts the Settings roles card shows.
/// </summary>
public class CoachRoleSummaryDto
{
    /// <summary>Role name (Trainer or Nutritionist).</summary>
    public string Role { get; set; } = string.Empty;

    /// <summary>Active client links that grant this role's discipline.</summary>
    public int ClientCount { get; set; }

    /// <summary>Of those, links that also grant the other discipline while the other role is active.</summary>
    public int SharedWithOtherRoleCount { get; set; }
}
