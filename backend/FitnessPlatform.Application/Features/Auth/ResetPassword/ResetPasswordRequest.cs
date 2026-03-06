namespace FitnessPlatform.Application.Features.Auth.ResetPassword;

/// <summary>
/// Request model for completing a password reset using a token.
/// </summary>
public class ResetPasswordRequest
{
    /// <summary>
    /// The password reset token received via email.
    /// </summary>
    public string Token { get; set; } = string.Empty;

    /// <summary>
    /// The user's email address.
    /// </summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// The new password.
    /// </summary>
    public string NewPassword { get; set; } = string.Empty;

    /// <summary>
    /// Confirmation of the new password.
    /// </summary>
    public string ConfirmPassword { get; set; } = string.Empty;
}
