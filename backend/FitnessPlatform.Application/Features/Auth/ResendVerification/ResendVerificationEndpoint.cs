using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using Microsoft.AspNetCore.Identity;

namespace FitnessPlatform.Application.Features.Auth.ResendVerification;

/// <summary>
/// Endpoint for resending the email verification email.
/// Requires authentication. Limited to 4 total emails (including the original).
/// </summary>
/// <param name="userManager">ASP.NET Identity user manager.</param>
/// <param name="tokenService">Shared email-verification token issuance service (see #679).</param>
public class ResendVerificationEndpoint(
    UserManager<ApplicationUser> userManager,
    IEmailVerificationTokenService tokenService)
    : EndpointWithoutRequest
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/auth/resend-verification");
        Summary(s =>
        {
            s.Summary = "Resend verification email";
            s.Description = "Resends the email verification email. Maximum 4 emails total (including the original).";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var user = await userManager.FindByIdAsync(userId);

        if (user is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        if (user.EmailConfirmed)
        {
            this.ThrowErrorWithCode(ErrorCodes.EmailAlreadyVerified, "Email is already verified.");
            return;
        }

        if (user.VerificationEmailsSent >= 4)
        {
            this.ThrowErrorWithCode(ErrorCodes.VerificationResendLimitReached, "Maximum number of verification emails reached.");
            return;
        }

        var language = HttpContext.Request.Headers.AcceptLanguage.FirstOrDefault() ?? "en";
        await tokenService.IssueAndSendAsync(user, language, ct);

        await Send.OkAsync(new
        {
            message = "Verification email sent.",
            remainingResends = 4 - user.VerificationEmailsSent
        }, ct);
    }
}
