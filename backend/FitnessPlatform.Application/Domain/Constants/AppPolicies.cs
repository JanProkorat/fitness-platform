namespace FitnessPlatform.Application.Domain.Constants;

/// <summary>
/// Constants for rate limiting and CORS policy names.
/// </summary>
public static class AppPolicies
{
    /// <summary>
    /// Rate limiting policy for authentication endpoints (login, register, password reset, social login, etc.).
    /// 10 requests per 15 minutes per IP.
    /// </summary>
    public const string AuthRateLimit = "auth";

    /// <summary>
    /// Rate limiting policy for the token refresh endpoint.
    /// A separate, higher-limit policy so transparent background refresh calls
    /// cannot exhaust the shared login budget.
    /// 120 requests per 15 minutes per IP — bounding flood abuse while allowing
    /// normal client behaviour (multiple tabs, background refresh, concurrent requests).
    /// </summary>
    public const string RefreshRateLimit = "auth-refresh";

    /// <summary>
    /// CORS policy for the web application.
    /// </summary>
    public const string AllowWebApp = nameof(AllowWebApp);
}
