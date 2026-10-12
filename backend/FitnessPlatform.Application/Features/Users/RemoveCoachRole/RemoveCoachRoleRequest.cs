namespace FitnessPlatform.Application.Features.Users.RemoveCoachRole;

/// <summary>
/// Request to remove one of the caller's coach roles.
/// </summary>
public class RemoveCoachRoleRequest
{
    /// <summary>Route parameter. The coach role to remove (Trainer or Nutritionist).</summary>
    public string Role { get; set; } = string.Empty;
}
