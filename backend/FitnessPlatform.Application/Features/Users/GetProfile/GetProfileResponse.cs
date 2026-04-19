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
    /// User's phone number.
    /// </summary>
    public string? PhoneNumber { get; set; }

    /// <summary>
    /// User's assigned roles.
    /// </summary>
    public List<string> Roles { get; set; } = [];

    /// <summary>
    /// Date and time when the account was created.
    /// </summary>
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// Whether the client has completed onboarding. Null for non-client users.
    /// </summary>
    public bool? IsOnboardingComplete { get; set; }

    /// <summary>
    /// Whether the user's email address has been verified.
    /// </summary>
    public bool EmailConfirmed { get; set; }

    /// <summary>
    /// Whether the client has an active link to a professional. Null/false for non-client users.
    /// </summary>
    public bool HasActiveLink { get; set; }

    /// <summary>
    /// Whether the client has a pending (not yet submitted) questionnaire. Null/false for non-client users.
    /// </summary>
    public bool HasPendingQuestionnaire { get; set; }

    /// <summary>
    /// Roles of professionals the client is actively linked with (e.g. ["Trainer"], ["Nutritionist"], or both).
    /// Empty for non-client users.
    /// </summary>
    public List<string> LinkedRoles { get; set; } = [];

    /// <summary>
    /// User's IANA time zone identifier (e.g. "Europe/Prague").
    /// </summary>
    public string TimeZone { get; set; } = "Europe/Prague";
}
