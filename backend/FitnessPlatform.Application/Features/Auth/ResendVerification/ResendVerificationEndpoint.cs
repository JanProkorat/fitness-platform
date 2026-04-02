using System.Security.Claims;
using System.Security.Cryptography;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Auth.ResendVerification;

/// <summary>
/// Endpoint for resending the email verification email.
/// Requires authentication. Limited to 4 total emails (including the original).
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="userManager">ASP.NET Identity user manager.</param>
/// <param name="emailService">Email sending service.</param>
public class ResendVerificationEndpoint(
    IApplicationDbContext db,
    UserManager<ApplicationUser> userManager,
    IEmailService emailService)
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

        // Invalidate previous unused tokens
        var previousTokens = await db.EmailVerificationTokens
            .Where(t => t.UserId == user.Id && t.UsedAt == null)
            .ToListAsync(ct);

        foreach (var t in previousTokens)
        {
            t.UsedAt = DateTime.UtcNow;
        }

        // Create new token
        var tokenValue = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var verificationToken = new EmailVerificationToken
        {
            UserId = user.Id,
            Token = tokenValue,
            ExpiresAt = DateTime.UtcNow.AddHours(24)
        };

        db.EmailVerificationTokens.Add(verificationToken);
        user.VerificationEmailsSent++;
        await db.SaveChangesAsync(ct);

        var language = HttpContext.Request.Headers.AcceptLanguage.FirstOrDefault() ?? "en";
        await emailService.SendEmailVerificationAsync(user.Email!, tokenValue, language, ct);

        await Send.OkAsync(new
        {
            message = "Verification email sent.",
            remainingResends = 4 - user.VerificationEmailsSent
        }, ct);
    }
}
