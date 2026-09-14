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
    /// Rate limiting policy for creating pending client invites.
    /// Partitioned per authenticated professional (not per IP, unlike the auth policies above) —
    /// the abuse case is one professional account flooding many distinct victims with unsolicited
    /// invites, so the meaningful bucket is the account, not the network address.
    /// 30 requests per 15 minutes per professional — generous enough for a coach bulk-onboarding
    /// an existing client roster in one sitting, tight enough to bound automated flooding
    /// (claude-security F8).
    /// </summary>
    public const string PendingInviteRateLimit = "pending-invite";

    /// <summary>
    /// CORS policy for the web application.
    /// </summary>
    public const string AllowWebApp = nameof(AllowWebApp);
}
