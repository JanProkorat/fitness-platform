using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using Microsoft.AspNetCore.Identity;

namespace FitnessPlatform.Application.Features.Auth.RequestPasswordReset;

/// <summary>
/// Endpoint for requesting a password reset. Generates a reset token and
/// sends it via email. Always returns 200 to prevent email enumeration.
/// </summary>
/// <param name="userManager">ASP.NET Identity user manager.</param>
/// <param name="emailService">Email service for sending password reset emails.</param>
/// <param name="logger">Logger instance.</param>
public class RequestPasswordResetEndpoint(
    UserManager<ApplicationUser> userManager,
    IEmailService emailService,
    ILogger<RequestPasswordResetEndpoint> logger) : Endpoint<RequestPasswordResetRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/auth/password/reset");
        AllowAnonymous();
        Options(x => x.RequireRateLimiting(AppPolicies.AuthRateLimit));
        Summary(s =>
        {
            s.Summary = "Request password reset";
            s.Description = "Sends a password reset token to the specified email. Always returns 200 to prevent email enumeration.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(RequestPasswordResetRequest req, CancellationToken ct)
    {
        var user = await userManager.FindByEmailAsync(req.Email);

        if (user is not null)
        {
            var token = await userManager.GeneratePasswordResetTokenAsync(user);

            var language = HttpContext.Request.Headers.AcceptLanguage.FirstOrDefault() ?? "en";
            await emailService.SendPasswordResetEmailAsync(req.Email, token, language, ct);

            logger.LogInformation(
                "Password reset email sent to {Email}",
                req.Email);
        }

        // Always return OK to prevent email enumeration
        await Send.OkAsync(new { Message = "If the email exists, a reset link has been sent." }, ct);
    }
}
