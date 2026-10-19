namespace FitnessPlatform.Application.Features.Auth.ChangeUnverifiedEmail;

/// <summary>
/// Request for changing the email address of an unverified account.
/// </summary>
public class ChangeUnverifiedEmailRequest
{
    /// <summary>The corrected email address.</summary>
    public string NewEmail { get; set; } = string.Empty;
}
