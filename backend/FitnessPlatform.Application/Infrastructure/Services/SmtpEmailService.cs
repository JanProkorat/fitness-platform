using System.Collections.Concurrent;
using System.Net;
using System.Reflection;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Interfaces;
using MailKit.Net.Smtp;
using MimeKit;
using Polly;
using Polly.Retry;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// SMTP-based email service implementation using MailKit.
/// Loads localized HTML templates from embedded resources.
/// Compatible with MailHog (no authentication) for local development.
/// Includes Polly retry logic (3 attempts with exponential backoff).
/// </summary>
public class SmtpEmailService(IConfiguration configuration, ILogger<SmtpEmailService> logger) : IEmailService
{
    /// <summary>
    /// Supported languages for email templates.
    /// </summary>
    private static readonly HashSet<string> SupportedLanguages = ["en", "cs", "de"];

    /// <summary>
    /// Cache for loaded email templates, keyed by resource name.
    /// </summary>
    private static readonly ConcurrentDictionary<string, string> TemplateCache = new();

    /// <summary>
    /// Localized email subjects for invitation emails.
    /// </summary>
    private static readonly Dictionary<string, string> InvitationSubjects = new()
    {
        ["en"] = "You have been invited to GF Platform",
        ["cs"] = "Pozvánka na GF Platform",
        ["de"] = "Einladung zur GF Platform"
    };

    /// <summary>
    /// Localized email subjects for password reset emails.
    /// </summary>
    private static readonly Dictionary<string, string> PasswordResetSubjects = new()
    {
        ["en"] = "Reset your GF Platform password",
        ["cs"] = "Obnovení hesla na GF Platform",
        ["de"] = "GF Platform Passwort zurücksetzen"
    };

    /// <summary>
    /// Localized email subjects for email verification emails.
    /// </summary>
    private static readonly Dictionary<string, string> EmailVerificationSubjects = new()
    {
        ["en"] = "Verify your GF Platform email",
        ["cs"] = "Ověřte svůj e-mail na GF Platform",
        ["de"] = "Bestätigen Sie Ihre E-Mail für GF Platform"
    };

    /// <summary>
    /// Polly retry pipeline: 3 retries with exponential backoff (1s, 2s, 4s).
    /// </summary>
    private static readonly ResiliencePipeline RetryPipeline = new ResiliencePipelineBuilder()
        .AddRetry(new RetryStrategyOptions
        {
            MaxRetryAttempts = 3,
            BackoffType = DelayBackoffType.Exponential,
            Delay = TimeSpan.FromSeconds(1)
        })
        .Build();

    /// <inheritdoc />
    public async Task SendInvitationEmailAsync(string toEmail, string trainerName, string invitationToken, string language, string? personalMessage, CancellationToken ct)
    {
        var lang = NormalizeLanguage(language);
        var baseUrl = configuration[ConfigKeys.AppBaseUrl] ?? "http://localhost:5173";
        var encodedToken = WebUtility.UrlEncode(invitationToken);
        var acceptUrl = $"{baseUrl}/invite/accept?token={encodedToken}";

        var template = LoadTemplate("Invitation", lang);
        var html = template
            .Replace("{{TrainerName}}", WebUtility.HtmlEncode(trainerName))
            .Replace("{{AcceptUrl}}", acceptUrl)
            .Replace("{{PersonalMessage}}", string.IsNullOrWhiteSpace(personalMessage)
                ? ""
                : $"""
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                    <tr>
                      <td style="background:rgba(201,168,76,0.06);border-left:3px solid #c9a84c;border-radius:4px;padding:16px 20px;font-size:14px;line-height:1.6;color:#a89f8c;font-style:italic;">
                        &ldquo;{WebUtility.HtmlEncode(personalMessage)}&rdquo;
                      </td>
                    </tr>
                  </table>
                  """);

        var subject = InvitationSubjects.GetValueOrDefault(lang, InvitationSubjects["en"]);

        await SendEmailAsync(toEmail, subject, html, ct);

        logger.LogInformation("Invitation email sent to {Email} from trainer {TrainerName} (lang={Language})", toEmail, trainerName, lang);
    }

    /// <inheritdoc />
    public async Task SendPasswordResetEmailAsync(string toEmail, string resetToken, string language, CancellationToken ct)
    {
        var lang = NormalizeLanguage(language);
        var baseUrl = configuration[ConfigKeys.AppBaseUrl] ?? "http://localhost:5173";
        var encodedToken = WebUtility.UrlEncode(resetToken);
        var encodedEmail = WebUtility.UrlEncode(toEmail);
        var resetUrl = $"{baseUrl}/auth/reset-password?token={encodedToken}&email={encodedEmail}";

        var template = LoadTemplate("PasswordReset", lang);
        var html = template.Replace("{{ResetUrl}}", resetUrl);

        var subject = PasswordResetSubjects.GetValueOrDefault(lang, PasswordResetSubjects["en"]);

        await SendEmailAsync(toEmail, subject, html, ct);

        logger.LogInformation("Password reset email sent to {Email} (lang={Language})", toEmail, lang);
    }

    /// <inheritdoc />
    public async Task SendEmailVerificationAsync(string toEmail, string verificationToken, string language, CancellationToken ct)
    {
        var lang = NormalizeLanguage(language);
        var baseUrl = configuration[ConfigKeys.AppBaseUrl] ?? "http://localhost:5173";
        var encodedToken = WebUtility.UrlEncode(verificationToken);
        var verifyUrl = $"{baseUrl}/verify-email?token={encodedToken}";

        var template = LoadTemplate("EmailVerification", lang);
        var html = template.Replace("{{VerifyUrl}}", verifyUrl);

        var subject = EmailVerificationSubjects.GetValueOrDefault(lang, EmailVerificationSubjects["en"]);

        await SendEmailAsync(toEmail, subject, html, ct);

        logger.LogInformation("Email verification sent to {Email} (lang={Language})", toEmail, lang);
    }

    /// <summary>
    /// Sends an email message via SMTP with Polly retry logic.
    /// </summary>
    /// <param name="toEmail">The recipient's email address.</param>
    /// <param name="subject">The email subject line.</param>
    /// <param name="htmlBody">The HTML body of the email.</param>
    /// <param name="ct">Cancellation token.</param>
    private async Task SendEmailAsync(string toEmail, string subject, string htmlBody, CancellationToken ct)
    {
        var smtpHost = configuration[ConfigKeys.EmailSmtpHost] ?? "localhost";
        var smtpPort = int.TryParse(configuration[ConfigKeys.EmailSmtpPort], out var port) ? port : 1025;
        var fromAddress = configuration[ConfigKeys.EmailFromAddress] ?? "noreply@fitnessplatform.local";
        var fromName = configuration[ConfigKeys.EmailFromName] ?? "GF Platform";

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, fromAddress));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = subject;

        message.Body = new TextPart("html")
        {
            Text = htmlBody
        };

        await RetryPipeline.ExecuteAsync(async token =>
        {
            using var client = new SmtpClient();
            await client.ConnectAsync(smtpHost, smtpPort, MailKit.Security.SecureSocketOptions.None, token);
            await client.SendAsync(message, token);
            await client.DisconnectAsync(true, token);
        }, ct);
    }

    /// <summary>
    /// Normalizes a language code to a supported two-letter code. Falls back to "en".
    /// </summary>
    /// <param name="language">The raw language string (e.g. "cs", "cs-CZ", "de-DE").</param>
    /// <returns>A supported two-letter language code.</returns>
    private static string NormalizeLanguage(string? language)
    {
        if (string.IsNullOrWhiteSpace(language))
            return "en";

        // Take first two characters (handles "cs-CZ" → "cs")
        var code = language.Length >= 2 ? language[..2].ToLowerInvariant() : language.ToLowerInvariant();
        return SupportedLanguages.Contains(code) ? code : "en";
    }

    /// <summary>
    /// Loads an email template from embedded resources with caching.
    /// Falls back to English if the requested language template is not found.
    /// </summary>
    /// <param name="templateName">The template name (e.g. "Invitation", "PasswordReset").</param>
    /// <param name="language">The two-letter language code.</param>
    /// <returns>The HTML template content.</returns>
    private static string LoadTemplate(string templateName, string language)
    {
        var resourceName = $"FitnessPlatform.Application.Infrastructure.EmailTemplates.{templateName}.{language}.html";

        return TemplateCache.GetOrAdd(resourceName, name =>
        {
            var assembly = Assembly.GetExecutingAssembly();
            using var stream = assembly.GetManifestResourceStream(name);

            if (stream is null)
            {
                var fallback = $"FitnessPlatform.Application.Infrastructure.EmailTemplates.{templateName}.en.html";
                using var fallbackStream = assembly.GetManifestResourceStream(fallback)
                    ?? throw new InvalidOperationException($"Email template '{fallback}' not found in embedded resources.");
                using var fallbackReader = new StreamReader(fallbackStream);
                return fallbackReader.ReadToEnd();
            }

            using var reader = new StreamReader(stream);
            return reader.ReadToEnd();
        });
    }
}
