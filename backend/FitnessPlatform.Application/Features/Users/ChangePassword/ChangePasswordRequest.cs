namespace FitnessPlatform.Application.Features.Users.ChangePassword;

/// <summary>
/// Request for changing the authenticated user's password.
/// </summary>
public class ChangePasswordRequest
{
    /// <summary>
    /// The user's current password.
    /// </summary>
    public string CurrentPassword { get; set; } = string.Empty;

    /// <summary>
    /// The new password. Must satisfy the Identity password policy.
    /// </summary>
    public string NewPassword { get; set; } = string.Empty;

    /// <summary>
    /// Repeat of the new password; must match <see cref="NewPassword"/>.
    /// </summary>
    public string ConfirmPassword { get; set; } = string.Empty;
}
