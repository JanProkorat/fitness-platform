namespace FitnessPlatform.Application.Features.Auth.ChangeUnverifiedEmail;

/// <summary>
/// Result of changing the email address of an unverified account.
/// </summary>
public class ChangeUnverifiedEmailResponse
{
    /// <summary>The address the verification email was sent to.</summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>How many more verification emails can be requested for this account.</summary>
    public int RemainingResends { get; set; }
}
