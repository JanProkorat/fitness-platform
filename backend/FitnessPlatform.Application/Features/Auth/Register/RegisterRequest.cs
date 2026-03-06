namespace FitnessPlatform.Application.Features.Auth.Register;

/// <summary>
/// Request model for user registration.
/// </summary>
public class RegisterRequest
{
    /// <summary>
    /// User's email address (used as login).
    /// </summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// User's chosen password.
    /// </summary>
    public string Password { get; set; } = string.Empty;

    /// <summary>
    /// Password confirmation (must match Password).
    /// </summary>
    public string ConfirmPassword { get; set; } = string.Empty;

    /// <summary>
    /// User's first name.
    /// </summary>
    public string FirstName { get; set; } = string.Empty;

    /// <summary>
    /// User's last name.
    /// </summary>
    public string LastName { get; set; } = string.Empty;

    /// <summary>
    /// The role the user is registering as.
    /// </summary>
    public string Role { get; set; } = string.Empty;

    /// <summary>
    /// Explicit GDPR consent for processing health data.
    /// </summary>
    public bool GdprConsent { get; set; }
}
