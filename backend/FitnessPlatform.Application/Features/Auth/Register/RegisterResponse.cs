namespace FitnessPlatform.Application.Features.Auth.Register;

/// <summary>
/// Response model returned after successful registration.
/// </summary>
public class RegisterResponse
{
    /// <summary>
    /// The newly created user's public ID.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// The user's email address.
    /// </summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// Confirmation message.
    /// </summary>
    public string Message { get; set; } = string.Empty;
}
