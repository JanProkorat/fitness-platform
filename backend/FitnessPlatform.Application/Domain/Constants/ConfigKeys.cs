namespace FitnessPlatform.Application.Domain.Constants;

/// <summary>
/// Constants for configuration keys used in appsettings.
/// </summary>
public static class ConfigKeys
{
    /// <summary>
    /// JWT signing secret key.
    /// </summary>
    public const string JwtSecret = "Jwt:Secret";

    /// <summary>
    /// Access token expiration in minutes.
    /// </summary>
    public const string JwtAccessTokenExpirationMinutes = "Jwt:AccessTokenExpirationMinutes";

    /// <summary>
    /// Refresh token expiration in days.
    /// </summary>
    public const string JwtRefreshTokenExpirationDays = "Jwt:RefreshTokenExpirationDays";

    /// <summary>
    /// PostgreSQL connection string key.
    /// </summary>
    public const string PostgreSql = "PostgreSQL";

    /// <summary>
    /// Allowed CORS origins configuration section.
    /// </summary>
    public const string CorsAllowedOrigins = "Cors:AllowedOrigins";

    /// <summary>
    /// Application base URL used for generating links in emails.
    /// </summary>
    public const string AppBaseUrl = "App:BaseUrl";

    /// <summary>
    /// SMTP server hostname for sending emails.
    /// </summary>
    public const string EmailSmtpHost = "Email:SmtpHost";

    /// <summary>
    /// SMTP server port for sending emails.
    /// </summary>
    public const string EmailSmtpPort = "Email:SmtpPort";

    /// <summary>
    /// Sender email address for outgoing emails.
    /// </summary>
    public const string EmailFromAddress = "Email:FromAddress";

    /// <summary>
    /// Sender display name for outgoing emails.
    /// </summary>
    public const string EmailFromName = "Email:FromName";
}
