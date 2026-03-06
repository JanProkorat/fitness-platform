namespace FitnessPlatform.Application.Domain.Constants;

/// <summary>
/// Constants for custom JWT claim names.
/// </summary>
public static class AppClaims
{
    /// <summary>
    /// Claim containing the user's ID.
    /// </summary>
    public const string UserId = nameof(UserId);

    /// <summary>
    /// Claim containing the user's email.
    /// </summary>
    public const string Email = nameof(Email);
}
