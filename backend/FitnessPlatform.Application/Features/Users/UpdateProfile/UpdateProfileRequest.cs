namespace FitnessPlatform.Application.Features.Users.UpdateProfile;

/// <summary>
/// Request model for updating the authenticated user's profile.
/// </summary>
public class UpdateProfileRequest
{
    /// <summary>
    /// Updated first name.
    /// </summary>
    public string FirstName { get; set; } = string.Empty;

    /// <summary>
    /// Updated last name.
    /// </summary>
    public string LastName { get; set; } = string.Empty;
}
