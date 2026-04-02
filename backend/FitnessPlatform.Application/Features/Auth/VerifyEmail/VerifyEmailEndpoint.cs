using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Auth.VerifyEmail;

/// <summary>
/// Endpoint for verifying a user's email address using a token from the verification email.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="userManager">ASP.NET Identity user manager.</param>
public class VerifyEmailEndpoint(IApplicationDbContext db, UserManager<ApplicationUser> userManager, IRealtimeNotifier notifier)
    : Endpoint<VerifyEmailRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/auth/verify-email");
        AllowAnonymous();
        Options(x => x.RequireRateLimiting(AppPolicies.AuthRateLimit));
        Summary(s =>
        {
            s.Summary = "Verify email address";
            s.Description = "Verifies a user's email address using the token sent via email. Token is valid for 24 hours.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(VerifyEmailRequest req, CancellationToken ct)
    {
        var token = await db.EmailVerificationTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Token == req.Token && t.UsedAt == null, ct);

        if (token is null)
        {
            this.ThrowErrorWithCode(ErrorCodes.InvalidVerificationToken, "Invalid verification token.");
            return;
        }

        if (token.ExpiresAt < DateTime.UtcNow)
        {
            this.ThrowErrorWithCode(ErrorCodes.VerificationTokenExpired, "Verification token has expired.");
            return;
        }

        token.UsedAt = DateTime.UtcNow;
        token.User.EmailConfirmed = true;
        await db.SaveChangesAsync(ct);

        await notifier.NotifyAsync(token.UserId, "emailVerified", new { }, ct);

        await Send.OkAsync(new { message = "Email verified successfully." }, ct);
    }
}
