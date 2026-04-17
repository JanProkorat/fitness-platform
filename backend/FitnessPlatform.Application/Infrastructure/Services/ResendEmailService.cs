using System.Collections.Concurrent;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Interfaces;
using Resend;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Email service implementation using the Resend HTTP API.
/// Loads the same localized HTML templates from embedded resources as SmtpEmailService.
/// Intended for production use; for local development use SmtpEmailService with MailHog.
/// </summary>
public class ResendEmailService(IResend resend, IConfiguration configuration, ILogger<ResendEmailService> logger) : IEmailService
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

    /// <inheritdoc />
    public async Task SendInvitationEmailAsync(string toEmail, string trainerName, string invitationToken, string language, string? personalMessage, CancellationToken ct)
    {
        var lang = NormalizeLanguage(language);
        var baseUrl = configuration[ConfigKeys.AppBaseUrl] ?? "http://localhost:5173";
        var encodedToken = System.Net.WebUtility.UrlEncode(invitationToken);
        var acceptUrl = $"{baseUrl}/invite/accept?token={encodedToken}";

        var template = LoadTemplate("Invitation", lang);
        var html = template
            .Replace("{{TrainerName}}", System.Net.WebUtility.HtmlEncode(trainerName))
            .Replace("{{AcceptUrl}}", acceptUrl)
            .Replace("{{PersonalMessage}}", string.IsNullOrWhiteSpace(personalMessage)
                ? ""
                : $"""
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                    <tr>
                      <td style="background:rgba(201,168,76,0.06);border-left:3px solid #c9a84c;border-radius:4px;padding:16px 20px;font-size:14px;line-height:1.6;color:#a89f8c;font-style:italic;">
                        &ldquo;{System.Net.WebUtility.HtmlEncode(personalMessage)}&rdquo;
                      </td>
                    </tr>
                  </table>
                  """);

        var subject = InvitationSubjects.GetValueOrDefault(lang, InvitationSubjects["en"]);

        await SendEmailAsync(toEmail, subject, html, ct);

        logger.LogInformation("Invitation email sent via Resend to {Email} from trainer {TrainerName} (lang={Language})", toEmail, trainerName, lang);
    }

    /// <inheritdoc />
    public async Task SendPasswordResetEmailAsync(string toEmail, string resetToken, string language, CancellationToken ct)
    {
        var lang = NormalizeLanguage(language);
        var baseUrl = configuration[ConfigKeys.AppBaseUrl] ?? "http://localhost:5173";
        var encodedToken = System.Net.WebUtility.UrlEncode(resetToken);
        var encodedEmail = System.Net.WebUtility.UrlEncode(toEmail);
        var resetUrl = $"{baseUrl}/auth/reset-password?token={encodedToken}&email={encodedEmail}";

        var template = LoadTemplate("PasswordReset", lang);
        var html = template.Replace("{{ResetUrl}}", resetUrl);

        var subject = PasswordResetSubjects.GetValueOrDefault(lang, PasswordResetSubjects["en"]);

        await SendEmailAsync(toEmail, subject, html, ct);

        logger.LogInformation("Password reset email sent via Resend to {Email} (lang={Language})", toEmail, lang);
    }

    /// <inheritdoc />
    public async Task SendEmailVerificationAsync(string toEmail, string verificationToken, string language, CancellationToken ct)
    {
        var lang = NormalizeLanguage(language);
        var baseUrl = configuration[ConfigKeys.AppBaseUrl] ?? "http://localhost:5173";
        var encodedToken = System.Net.WebUtility.UrlEncode(verificationToken);
        var verifyUrl = $"{baseUrl}/verify-email?token={encodedToken}";

        var template = LoadTemplate("EmailVerification", lang);
        var html = template.Replace("{{VerifyUrl}}", verifyUrl);

        var subject = EmailVerificationSubjects.GetValueOrDefault(lang, EmailVerificationSubjects["en"]);

        await SendEmailAsync(toEmail, subject, html, ct);

        logger.LogInformation("Email verification sent via Resend to {Email} (lang={Language})", toEmail, lang);
    }

    /// <summary>
    /// Sends an email message via the Resend API.
    /// </summary>
    /// <param name="toEmail">The recipient's email address.</param>
    /// <param name="subject">The email subject line.</param>
    /// <param name="htmlBody">The HTML body of the email.</param>
    /// <param name="ct">Cancellation token.</param>
    private async Task SendEmailAsync(string toEmail, string subject, string htmlBody, CancellationToken ct)
    {
        var fromAddress = configuration[ConfigKeys.EmailFromAddress] ?? "noreply@fitnessplatform.local";
        var fromName = configuration[ConfigKeys.EmailFromName] ?? "GF Platform";

        var message = new EmailMessage
        {
            From = $"{fromName} <{fromAddress}>",
            Subject = subject,
            HtmlBody = htmlBody
        };
        message.To.Add(toEmail);

        await resend.EmailSendAsync(message, ct);
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

        var code = language.Length >= 2 ? language[..2].ToLowerInvariant() : language.ToLowerInvariant();
        return SupportedLanguages.Contains(code) ? code : "en";
    }

    /// <summary>
    /// Loads an email template from the deployed content directory with caching.
    /// Falls back to English if the requested language template is not found.
    /// </summary>
    /// <param name="templateName">The template name (e.g. "Invitation", "PasswordReset").</param>
    /// <param name="language">The two-letter language code.</param>
    /// <returns>The HTML template content.</returns>
    private static string LoadTemplate(string templateName, string language)
    {
        var key = $"{templateName}.{language}";

        return TemplateCache.GetOrAdd(key, _ =>
        {
            var path = BuildTemplatePath(templateName, language);
            if (File.Exists(path))
                return File.ReadAllText(path);

            var fallback = BuildTemplatePath(templateName, "en");
            if (!File.Exists(fallback))
                throw new InvalidOperationException($"Email template '{fallback}' not found on disk.");
            return File.ReadAllText(fallback);
        });
    }

    private static string BuildTemplatePath(string templateName, string language) =>
        Path.Combine(AppContext.BaseDirectory, "Infrastructure", "EmailTemplates", $"{templateName}.{language}.html");
}
