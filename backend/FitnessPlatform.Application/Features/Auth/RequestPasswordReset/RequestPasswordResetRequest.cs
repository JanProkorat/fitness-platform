namespace FitnessPlatform.Application.Features.Auth.RequestPasswordReset;

/// <summary>
/// Request model for initiating a password reset.
/// </summary>
public class RequestPasswordResetRequest
{
    /// <summary>
    /// Email address of the account to reset.
    /// </summary>
    public string Email { get; set; } = string.Empty;
}
