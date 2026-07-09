using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FitnessPlatform.Application.Features.Auth.AnonymousResendVerification;

/// <summary>
/// Anonymous endpoint for requesting a verification-email resend, keyed by email
/// address instead of an authenticated session (#679). Unblocks the resend
/// affordance on RegisterStep4 (web #621), where the user has no access token yet.
/// </summary>
/// <remarks>
/// <para>
/// No-enumeration contract (hard requirement — see design review #679): every
/// branch below — unregistered email, already-verified account, throttled
/// (rolling-window cap), and a real send — returns the SAME 200 with the SAME
/// generic body. Do not add a differing field (e.g. a remaining-resends counter)
/// or throw the <see cref="ErrorCodes.EmailAlreadyVerified"/> /
/// <see cref="ErrorCodes.VerificationResendLimitReached"/> codes the authenticated
/// <c>/auth/resend-verification</c> endpoint uses — those would turn the response
/// into an account-existence oracle. The residual timing side-channel (the
/// unverified branch does DB writes + an email send; the other branches return
/// immediately) is a known, accepted limitation flagged for the mandatory
/// gc-sec-review pass rather than solved here.
/// </para>
/// <para>
/// Anti-abuse gate (security-review follow-up, #679): this endpoint does NOT gate
/// on <see cref="ApplicationUser.VerificationEmailsSent"/> (the lifetime counter
/// the AUTHENTICATED resend endpoint enforces). Because this endpoint is
/// anonymous, any caller who knows a victim's email could otherwise drive that
/// lifetime counter to its cap and permanently lock the victim out of ever
/// getting a verification email again through ANY channel — an anonymous
/// denial-of-verification. Instead this endpoint is throttled on RECENT activity:
/// at most <see cref="MaxSendsPerWindow"/> sends per rolling <see cref="Window"/>
/// (read from existing <see cref="EmailVerificationToken"/> rows — no new table,
/// no migration). A short inter-send cooldown was considered but deliberately
/// dropped: it would also block the common legitimate case of a user clicking
/// "resend" seconds after registering because the first email did not arrive —
/// exactly the scenario this endpoint exists to unblock. The window cap alone
/// already bounds daily volume. The token service call passes
/// <c>countTowardLifetimeCap: false</c> so this path can never advance the
/// authenticated endpoint's cap, bounding anonymous abuse to a nuisance (at
/// most <see cref="MaxSendsPerWindow"/> emails per rolling day) rather than a
/// permanent lockout.
/// </para>
/// </remarks>
/// <param name="userManager">ASP.NET Identity user manager.</param>
/// <param name="tokenService">Shared email-verification token issuance service (see #679).</param>
/// <param name="db">Database context — used to count recent tokens for the anti-abuse throttle.</param>
/// <param name="logger">Logger for non-fatal send failures.</param>
public class AnonymousResendVerificationEndpoint(
    UserManager<ApplicationUser> userManager,
    IEmailVerificationTokenService tokenService,
    IApplicationDbContext db,
    ILogger<AnonymousResendVerificationEndpoint> logger)
    : Endpoint<AnonymousResendVerificationRequest, AnonymousResendVerificationResponse>
{
    private const string GenericMessage = "If an unverified account exists for this email, a verification email has been sent.";

    /// <summary>
    /// Maximum anonymous-triggered sends allowed per user within <see cref="Window"/>.
    /// Chosen to comfortably cover a user who genuinely lost the original email and
    /// retries a couple of times, while bounding an anonymous attacker's nuisance
    /// volume against a victim's inbox to a small, fixed number per day.
    /// </summary>
    private const int MaxSendsPerWindow = 3;

    /// <summary>Rolling window over which <see cref="MaxSendsPerWindow"/> is counted.</summary>
    private static readonly TimeSpan Window = TimeSpan.FromHours(24);

    /// <inheritdoc />
    public override void Configure()
    {
        Post("/auth/resend-verification/anonymous");
        AllowAnonymous();
        Options(x => x.RequireRateLimiting(AppPolicies.AuthRateLimit));
        Summary(s =>
        {
            s.Summary = "Resend verification email (anonymous)";
            s.Description = "Resends the email verification email for an unverified account, keyed by email address instead of an authenticated session. " +
                "Always returns the same generic response regardless of account state to prevent email enumeration.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(AnonymousResendVerificationRequest req, CancellationToken ct)
    {
        // Look up the user unconditionally (even though the result only changes
        // behaviour, never the response) — see the no-enumeration remarks above.
        var user = await userManager.FindByEmailAsync(req.Email);

        if (user is not null && !user.EmailConfirmed && await IsWithinThrottleBudgetAsync(user.Id, ct))
        {
            var language = HttpContext.Request.Headers.AcceptLanguage.FirstOrDefault() ?? "en";
            try
            {
                // countTowardLifetimeCap: false — anonymous sends must never advance
                // VerificationEmailsSent (see the class remarks / interface doc comment
                // for why: doing so would let anonymous abuse re-create a permanent
                // lockout of the authenticated resend path over repeated 24h windows).
                await tokenService.IssueAndSendAsync(user, language, ct, countTowardLifetimeCap: false);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Non-fatal: never let an email-provider failure surface as a different
                // response than the other no-op branches (unregistered / already-verified /
                // throttled) — that would leak account existence.
                logger.LogError(ex,
                    "Failed to send anonymous verification-resend email to {Email}.",
                    req.Email);
            }
        }

        // Identical response for every branch: unregistered email, already-verified
        // account, throttled (window cap), and a real send all land here.
        await Send.OkAsync(new AnonymousResendVerificationResponse { Message = GenericMessage }, ct);
    }

    /// <summary>
    /// Checks the rolling-window throttle against existing
    /// <see cref="EmailVerificationToken"/> rows for this user — migration-free anti-abuse
    /// gate for the anonymous send path (see class remarks).
    /// </summary>
    private async Task<bool> IsWithinThrottleBudgetAsync(Guid userId, CancellationToken ct)
    {
        var windowStart = DateTime.UtcNow - Window;

        var recentSendCount = await db.EmailVerificationTokens
            .CountAsync(t => t.UserId == userId && t.DateCreated >= windowStart, ct);

        return recentSendCount < MaxSendsPerWindow;
    }
}
