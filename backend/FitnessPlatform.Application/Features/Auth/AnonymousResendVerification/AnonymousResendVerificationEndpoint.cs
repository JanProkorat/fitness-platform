using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;

namespace FitnessPlatform.Application.Features.Auth.AnonymousResendVerification;

/// <summary>
/// Anonymous endpoint for requesting a verification-email resend, keyed by email
/// address instead of an authenticated session (#679). Unblocks the resend
/// affordance on RegisterStep4 (web #621), where the user has no access token yet.
/// </summary>
/// <remarks>
/// No-enumeration contract (hard requirement — see design review #679): every
/// branch below — unregistered email, already-verified account, resend-cap
/// reached, and a real send — returns the SAME 200 with the SAME generic body.
/// Do not add a differing field (e.g. a remaining-resends counter) or throw the
/// <see cref="ErrorCodes.EmailAlreadyVerified"/> / <see cref="ErrorCodes.VerificationResendLimitReached"/>
/// codes the authenticated <c>/auth/resend-verification</c> endpoint uses — those
/// would turn the response into an account-existence oracle. The residual timing
/// side-channel (the unverified branch does DB writes + an email send; the other
/// branches return immediately) is a known, accepted limitation flagged for the
/// mandatory gc-sec-review pass rather than solved here.
/// </remarks>
/// <param name="userManager">ASP.NET Identity user manager.</param>
/// <param name="tokenService">Shared email-verification token issuance service (see #679).</param>
/// <param name="logger">Logger for non-fatal send failures.</param>
public class AnonymousResendVerificationEndpoint(
    UserManager<ApplicationUser> userManager,
    IEmailVerificationTokenService tokenService,
    ILogger<AnonymousResendVerificationEndpoint> logger)
    : Endpoint<AnonymousResendVerificationRequest, AnonymousResendVerificationResponse>
{
    private const string GenericMessage = "If an unverified account exists for this email, a verification email has been sent.";

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

        if (user is not null && !user.EmailConfirmed && user.VerificationEmailsSent < 4)
        {
            var language = HttpContext.Request.Headers.AcceptLanguage.FirstOrDefault() ?? "en";
            try
            {
                await tokenService.IssueAndSendAsync(user, language, ct);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Non-fatal: never let an email-provider failure surface as a different
                // response than the other no-op branches (unregistered / already-verified /
                // resend-cap reached) — that would leak account existence.
                logger.LogError(ex,
                    "Failed to send anonymous verification-resend email to {Email}.",
                    req.Email);
            }
        }

        // Identical response for every branch: unregistered email, already-verified
        // account, resend-cap reached, and a real send all land here.
        await Send.OkAsync(new AnonymousResendVerificationResponse { Message = GenericMessage }, ct);
    }
}
