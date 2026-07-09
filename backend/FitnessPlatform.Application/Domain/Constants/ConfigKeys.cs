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
    /// Grace window (in seconds) during which a just-rotated refresh token can be
    /// presented again and treated as a benign concurrent double-fire (e.g. a
    /// client retry racing its own successful request) rather than theft. Reuse
    /// presented outside this window triggers full token-family revocation.
    /// </summary>
    public const string RefreshTokenReuseGraceWindowSeconds = "Jwt:RefreshTokenReuseGraceWindowSeconds";

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

    /// <summary>
    /// Email provider selection. Use "Resend" for Resend API or "Smtp" (default) for SMTP/MailHog.
    /// </summary>
    public const string EmailProvider = "Email:Provider";

    /// <summary>
    /// Resend API token for sending emails via Resend.
    /// </summary>
    public const string ResendApiToken = "Resend:ApiToken";

    /// <summary>
    /// MongoDB connection string key.
    /// </summary>
    public const string MongoDb = "MongoDB";

    /// <summary>
    /// MongoDB database name.
    /// </summary>
    public const string MongoDbDatabaseName = "MongoDB:DatabaseName";

    /// <summary>
    /// Google OAuth 2.0 client ID used to verify Google ID tokens.
    /// </summary>
    public const string GoogleClientId = "Google:ClientId";

    /// <summary>
    /// Apple Service ID (reverse-domain format) used as the JWT audience when verifying Apple identity tokens.
    /// </summary>
    public const string AppleClientId = "Apple:ClientId";
}
