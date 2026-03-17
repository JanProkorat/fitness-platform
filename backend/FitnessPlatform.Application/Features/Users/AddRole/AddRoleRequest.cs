namespace FitnessPlatform.Application.Features.Users.AddRole;

/// <summary>
/// Request to add a professional role to the current user.
/// </summary>
public class AddRoleRequest
{
    /// <summary>
    /// The role to add (Trainer or Nutritionist).
    /// </summary>
    public string Role { get; set; } = string.Empty;
}
