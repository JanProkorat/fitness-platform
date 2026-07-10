using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using Microsoft.AspNetCore.Identity;

namespace FitnessPlatform.Application.Features.Auth.ResetPassword;

/// <summary>
/// Endpoint for completing a password reset using a token received via email.
/// </summary>
/// <param name="userManager">ASP.NET Identity user manager.</param>
public class ResetPasswordEndpoint(UserManager<ApplicationUser> userManager) : Endpoint<ResetPasswordRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/auth/password/reset");
        AllowAnonymous();
        Options(x => x.RequireRateLimiting(AppPolicies.AuthRateLimit));
        Summary(s =>
        {
            s.Summary = "Reset password";
            s.Description = "Completes a password reset using the token received via email.";
        });
    }

    /// <summary>
    /// Generic failure message shared by both the non-existent-email branch and the
    /// invalid/expired/used-token branch. Both MUST throw this exact same message —
    /// surfacing Identity's distinct "Invalid token." text (or any of
    /// <see cref="IdentityResult.Errors"/>) only when the email exists would let an
    /// attacker enumerate registered accounts by comparing response text. See #656.
    ///
    /// Password-policy violations (weak new password) are intentionally NOT routed
    /// through this generic branch — <see cref="ResetPasswordValidator"/> mirrors the
    /// Identity password policy and rejects weak passwords before HandleAsync runs,
    /// so a valid-token user always sees the specific, actionable policy error rather
    /// than this generic one. See #692.
    /// </summary>
    private const string GenericResetFailureMessage = "Invalid or expired password reset request.";

    /// <inheritdoc />
    public override async Task HandleAsync(ResetPasswordRequest req, CancellationToken ct)
    {
        var user = await userManager.FindByEmailAsync(req.Email);

        if (user is null)
        {
            ThrowError(GenericResetFailureMessage);
            return;
        }

        var result = await userManager.ResetPasswordAsync(user, req.Token, req.NewPassword);

        if (!result.Succeeded)
        {
            ThrowError(GenericResetFailureMessage);
            return;
        }

        await Send.OkAsync(new { Message = "Password has been reset successfully." }, ct);
    }
}
