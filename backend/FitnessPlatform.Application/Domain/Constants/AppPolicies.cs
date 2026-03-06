namespace FitnessPlatform.Application.Domain.Constants;

/// <summary>
/// Constants for rate limiting and CORS policy names.
/// </summary>
public static class AppPolicies
{
    /// <summary>
    /// Rate limiting policy for authentication endpoints.
    /// </summary>
    public const string AuthRateLimit = "auth";

    /// <summary>
    /// CORS policy for the web application.
    /// </summary>
    public const string AllowWebApp = nameof(AllowWebApp);
}
