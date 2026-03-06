namespace FitnessPlatform.Application.Features.Users.GetProfile;

/// <summary>
/// Response model for the authenticated user's profile.
/// </summary>
public class GetProfileResponse
{
    /// <summary>
    /// User's public ID.
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// User's email address.
    /// </summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// User's first name.
    /// </summary>
    public string FirstName { get; set; } = string.Empty;

    /// <summary>
    /// User's last name.
    /// </summary>
    public string LastName { get; set; } = string.Empty;

    /// <summary>
    /// User's assigned roles.
    /// </summary>
    public List<string> Roles { get; set; } = [];

    /// <summary>
    /// Date and time when the account was created.
    /// </summary>
    public DateTime DateCreated { get; set; }
}
