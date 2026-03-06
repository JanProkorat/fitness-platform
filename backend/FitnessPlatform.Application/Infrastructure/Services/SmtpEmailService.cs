using System.Net;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Interfaces;
using MailKit.Net.Smtp;
using MimeKit;
using Polly;
using Polly.Retry;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// SMTP-based email service implementation using MailKit.
/// Reads configuration from the <c>Email</c> and <c>App</c> sections of appsettings.
/// Compatible with MailHog (no authentication) for local development.
/// Includes Polly retry logic (3 attempts with exponential backoff).
/// </summary>
public class SmtpEmailService(IConfiguration configuration, ILogger<SmtpEmailService> logger) : IEmailService
{
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
    public async Task SendInvitationEmailAsync(string toEmail, string trainerName, string invitationToken, CancellationToken ct)
    {
        var baseUrl = configuration[ConfigKeys.AppBaseUrl] ?? "http://localhost:5173";
        var encodedToken = WebUtility.UrlEncode(invitationToken);
        var acceptUrl = $"{baseUrl}/invite/accept?token={encodedToken}";

        var subject = "You have been invited to GF Platform";
        var html = BuildInvitationHtml(trainerName, acceptUrl);

        await SendEmailAsync(toEmail, subject, html, ct);

        logger.LogInformation("Invitation email sent to {Email} from trainer {TrainerName}", toEmail, trainerName);
    }

    /// <inheritdoc />
    public async Task SendPasswordResetEmailAsync(string toEmail, string resetToken, CancellationToken ct)
    {
        var baseUrl = configuration[ConfigKeys.AppBaseUrl] ?? "http://localhost:5173";
        var encodedToken = WebUtility.UrlEncode(resetToken);
        var encodedEmail = WebUtility.UrlEncode(toEmail);
        var resetUrl = $"{baseUrl}/auth/reset-password?token={encodedToken}&email={encodedEmail}";

        var subject = "Reset your GF Platform password";
        var html = BuildPasswordResetHtml(resetUrl);

        await SendEmailAsync(toEmail, subject, html, ct);

        logger.LogInformation("Password reset email sent to {Email}", toEmail);
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
    /// Builds the HTML body for a client invitation email in the GF Platform dark+gold design.
    /// </summary>
    /// <param name="trainerName">The name of the inviting trainer.</param>
    /// <param name="acceptUrl">The URL to accept the invitation.</param>
    /// <returns>The HTML email body.</returns>
    private static string BuildInvitationHtml(string trainerName, string acceptUrl)
    {
        var encodedName = WebUtility.HtmlEncode(trainerName);
        return $$"""
                 <!DOCTYPE html>
                 <html lang="en">
                 <head>
                   <meta charset="UTF-8">
                   <meta name="viewport" content="width=device-width, initial-scale=1.0">
                   <title>You're Invited to GF Platform</title>
                 </head>
                 <body style="margin:0;padding:0;background-color:#0d0d0d;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
                   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0d0d0d;padding:40px 16px;">
                     <tr>
                       <td align="center">
                         <!-- Outer container -->
                         <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
                           <!-- Logo -->
                           <tr>
                             <td style="text-align:center;padding-bottom:32px;">
                               <span style="font-size:22px;font-weight:800;letter-spacing:3px;color:#c9a84c;text-transform:uppercase;">GF</span>
                               <span style="font-size:22px;font-weight:400;letter-spacing:1px;color:#a89f8c;text-transform:uppercase;"> PLATFORM</span>
                             </td>
                           </tr>
                           <!-- Card -->
                           <tr>
                             <td style="background-color:#161616;border:1px solid #2a2a2a;border-radius:4px;padding:40px 32px;">
                               <!-- Icon -->
                               <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                 <tr>
                                   <td style="text-align:center;padding-bottom:24px;">
                                     <div style="display:inline-block;width:56px;height:56px;line-height:56px;font-size:28px;background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.2);border-radius:4px;text-align:center;">&#x1F3CB;&#xFE0F;</div>
                                   </td>
                                 </tr>
                               </table>
                               <!-- Label -->
                               <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                 <tr>
                                   <td style="text-align:center;padding-bottom:8px;">
                                     <span style="font-size:10px;font-weight:700;letter-spacing:3px;color:#8a6f2e;text-transform:uppercase;">INVITATION</span>
                                   </td>
                                 </tr>
                               </table>
                               <!-- Heading -->
                               <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                 <tr>
                                   <td style="text-align:center;padding-bottom:16px;">
                                     <h1 style="margin:0;font-size:24px;font-weight:700;color:#f0ece4;line-height:1.3;">You've Been Invited</h1>
                                   </td>
                                 </tr>
                               </table>
                               <!-- Body -->
                               <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                 <tr>
                                   <td style="text-align:center;font-size:15px;line-height:1.6;color:#a89f8c;padding-bottom:32px;">
                                     <strong style="color:#f0ece4;">{{encodedName}}</strong> has invited you to join GF Platform as their client. Start your personalized fitness journey today.
                                   </td>
                                 </tr>
                               </table>
                               <!-- CTA Button -->
                               <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                 <tr>
                                   <td align="center" style="padding-bottom:32px;">
                                     <a href="{{acceptUrl}}" style="display:inline-block;background-color:#c9a84c;color:#000000;text-decoration:none;font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;padding:14px 40px;border-radius:2px;">Accept Invitation</a>
                                   </td>
                                 </tr>
                               </table>
                               <!-- Divider -->
                               <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                 <tr>
                                   <td style="border-top:1px solid #2a2a2a;padding-top:20px;">
                                     <p style="margin:0;font-size:12px;line-height:1.6;color:#5a5248;">If you did not expect this invitation, you can safely ignore this email.</p>
                                     <p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#5a5248;">If the button doesn't work, copy this URL into your browser:</p>
                                     <p style="margin:4px 0 0;font-size:11px;word-break:break-all;"><a href="{{acceptUrl}}" style="color:#c9a84c;text-decoration:underline;">{{acceptUrl}}</a></p>
                                   </td>
                                 </tr>
                               </table>
                             </td>
                           </tr>
                           <!-- Footer -->
                           <tr>
                             <td style="text-align:center;padding-top:24px;">
                               <p style="margin:0;font-size:11px;color:#5a5248;letter-spacing:1px;">GF Platform &mdash; Fitness & Nutrition</p>
                             </td>
                           </tr>
                         </table>
                       </td>
                     </tr>
                   </table>
                 </body>
                 </html>
                 """;
    }

    /// <summary>
    /// Builds the HTML body for a password reset email in the GF Platform dark+gold design.
    /// </summary>
    /// <param name="resetUrl">The URL to reset the password.</param>
    /// <returns>The HTML email body.</returns>
    private static string BuildPasswordResetHtml(string resetUrl)
    {
        return $$"""
                 <!DOCTYPE html>
                 <html lang="en">
                 <head>
                   <meta charset="UTF-8">
                   <meta name="viewport" content="width=device-width, initial-scale=1.0">
                   <title>Reset Your Password</title>
                 </head>
                 <body style="margin:0;padding:0;background-color:#0d0d0d;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
                   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0d0d0d;padding:40px 16px;">
                     <tr>
                       <td align="center">
                         <!-- Outer container -->
                         <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
                           <!-- Logo -->
                           <tr>
                             <td style="text-align:center;padding-bottom:32px;">
                               <span style="font-size:22px;font-weight:800;letter-spacing:3px;color:#c9a84c;text-transform:uppercase;">GF</span>
                               <span style="font-size:22px;font-weight:400;letter-spacing:1px;color:#a89f8c;text-transform:uppercase;"> PLATFORM</span>
                             </td>
                           </tr>
                           <!-- Card -->
                           <tr>
                             <td style="background-color:#161616;border:1px solid #2a2a2a;border-radius:4px;padding:40px 32px;">
                               <!-- Icon -->
                               <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                 <tr>
                                   <td style="text-align:center;padding-bottom:24px;">
                                     <div style="display:inline-block;width:56px;height:56px;line-height:56px;font-size:28px;background:rgba(192,57,43,0.08);border:1px solid rgba(192,57,43,0.2);border-radius:4px;text-align:center;">&#x1F512;</div>
                                   </td>
                                 </tr>
                               </table>
                               <!-- Label -->
                               <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                 <tr>
                                   <td style="text-align:center;padding-bottom:8px;">
                                     <span style="font-size:10px;font-weight:700;letter-spacing:3px;color:#8a6f2e;text-transform:uppercase;">SECURITY</span>
                                   </td>
                                 </tr>
                               </table>
                               <!-- Heading -->
                               <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                 <tr>
                                   <td style="text-align:center;padding-bottom:16px;">
                                     <h1 style="margin:0;font-size:24px;font-weight:700;color:#f0ece4;line-height:1.3;">Password Reset</h1>
                                   </td>
                                 </tr>
                               </table>
                               <!-- Body -->
                               <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                 <tr>
                                   <td style="text-align:center;font-size:15px;line-height:1.6;color:#a89f8c;padding-bottom:32px;">
                                     We received a request to reset your GF Platform password. Click the button below to choose a new password. This link expires in <strong style="color:#f0ece4;">1 hour</strong>.
                                   </td>
                                 </tr>
                               </table>
                               <!-- CTA Button -->
                               <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                 <tr>
                                   <td align="center" style="padding-bottom:32px;">
                                     <a href="{{resetUrl}}" style="display:inline-block;background-color:#c9a84c;color:#000000;text-decoration:none;font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;padding:14px 40px;border-radius:2px;">Reset Password</a>
                                   </td>
                                 </tr>
                               </table>
                               <!-- Divider -->
                               <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                 <tr>
                                   <td style="border-top:1px solid #2a2a2a;padding-top:20px;">
                                     <p style="margin:0;font-size:12px;line-height:1.6;color:#5a5248;">If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
                                     <p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#5a5248;">If the button doesn't work, copy this URL into your browser:</p>
                                     <p style="margin:4px 0 0;font-size:11px;word-break:break-all;"><a href="{{resetUrl}}" style="color:#c9a84c;text-decoration:underline;">{{resetUrl}}</a></p>
                                   </td>
                                 </tr>
                               </table>
                             </td>
                           </tr>
                           <!-- Footer -->
                           <tr>
                             <td style="text-align:center;padding-top:24px;">
                               <p style="margin:0;font-size:11px;color:#5a5248;letter-spacing:1px;">GF Platform &mdash; Fitness & Nutrition</p>
                             </td>
                           </tr>
                         </table>
                       </td>
                     </tr>
                   </table>
                 </body>
                 </html>
                 """;
    }
}
