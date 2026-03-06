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

    /// <inheritdoc />
    public override async Task HandleAsync(ResetPasswordRequest req, CancellationToken ct)
    {
        var user = await userManager.FindByEmailAsync(req.Email);

        if (user is null)
        {
            ThrowError("Invalid reset request.");
            return;
        }

        var result = await userManager.ResetPasswordAsync(user, req.Token, req.NewPassword);

        if (!result.Succeeded)
        {
            foreach (var error in result.Errors)
            {
                AddError(error.Description);
            }

            ThrowIfAnyErrors();
        }

        await Send.OkAsync(new { Message = "Password has been reset successfully." }, ct);
    }
}
