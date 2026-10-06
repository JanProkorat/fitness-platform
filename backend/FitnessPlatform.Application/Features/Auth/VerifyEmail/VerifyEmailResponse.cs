namespace FitnessPlatform.Application.Features.Auth.VerifyEmail;

/// <summary>
/// Response returned after an email address has been verified.
/// </summary>
public class VerifyEmailResponse
{
    /// <summary>
    /// Human-readable confirmation message.
    /// </summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// The verified email address.
    /// </summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// First name of the verified account.
    /// </summary>
    public string FirstName { get; set; } = string.Empty;

    /// <summary>
    /// Roles held by the verified account.
    /// </summary>
    public List<string> Roles { get; set; } = [];
}
