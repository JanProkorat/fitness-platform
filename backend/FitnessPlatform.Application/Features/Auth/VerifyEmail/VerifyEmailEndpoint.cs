using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FitnessPlatform.Application.Features.Auth.VerifyEmail;

/// <summary>
/// Endpoint for verifying a user's email address using a token from the verification email.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="notifier">Realtime notifier used to push the email-verified event to the client.</param>
/// <param name="inviteConversationSeeder">
/// Seeds a professional-client conversation against any non-accepted PendingInvite already
/// addressed to this email, now that the account is verified (#1100, R4 — moved here from
/// RegisterEndpoint so an invite thread never exists for an unverified account).
/// </param>
/// <param name="logger">Logger for the seeder's non-fatal failure path.</param>
public class VerifyEmailEndpoint(
    IApplicationDbContext db,
    IRealtimeNotifier notifier,
    IPendingInviteConversationSeeder inviteConversationSeeder,
    ILogger<VerifyEmailEndpoint> logger)
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

        // Verified accounts only (R4): a PendingInvite always represents inviting a Client, so
        // gate on ClientProfile existence — the same signal RegisterEndpoint used to gate this
        // seed before it moved here — to skip it for a professional-only account. Non-fatal:
        // verification already succeeded and must not 500 on a seeding failure; the accept-time
        // "ensure Invited" call inside AcceptClientInviteEndpoint / AcceptInvitationEndpoint
        // remains the fallback if this seed never runs.
        var isClientAccount = await db.ClientProfiles
            .AsNoTracking()
            .AnyAsync(cp => cp.UserId == token.UserId, ct);

        if (isClientAccount)
        {
            try
            {
                await inviteConversationSeeder.SeedForNewUserAsync(token.User, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex,
                    "Failed to seed pending-invite conversation(s) for {Email} during email verification. Email verified; conversation will still be seeded at invite-accept time.",
                    token.User.Email);
            }
        }

        await notifier.NotifyAsync(token.UserId, "emailverified", new { }, ct);

        await Send.OkAsync(new { message = "Email verified successfully." }, ct);
    }
}
