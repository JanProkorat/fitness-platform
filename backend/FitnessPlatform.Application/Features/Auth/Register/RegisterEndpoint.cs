using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using Microsoft.AspNetCore.Identity;

namespace FitnessPlatform.Application.Features.Auth.Register;

/// <summary>
/// Endpoint for registering a new user account.
/// </summary>
/// <param name="userManager">ASP.NET Identity user manager.</param>
/// <param name="audit">Audit logging service.</param>
public class RegisterEndpoint(UserManager<ApplicationUser> userManager, IAuditService audit) : Endpoint<RegisterRequest, RegisterResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/auth/register");
        AllowAnonymous();
        Options(x => x.RequireRateLimiting(AppPolicies.AuthRateLimit));
        Summary(s =>
        {
            s.Summary = "Register a new user";
            s.Description = "Creates a new user account with the specified role and GDPR consent.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(RegisterRequest req, CancellationToken ct)
    {
        var user = new ApplicationUser
        {
            UserName = req.Email,
            Email = req.Email,
            FirstName = req.FirstName,
            LastName = req.LastName,
            GdprConsent = req.GdprConsent,
            GdprConsentDate = DateTime.UtcNow
        };

        var result = await userManager.CreateAsync(user, req.Password);

        if (!result.Succeeded)
        {
            foreach (var error in result.Errors)
            {
                AddError(error.Description);
            }

            ThrowIfAnyErrors();
        }

        var role = Enum.Parse<UserRole>(req.Role, ignoreCase: true);
        await userManager.AddToRoleAsync(user, role.ToString());

        // Audit: GDPR consent recorded at registration
        await audit.LogAsync(
            user.Id,
            "Register",
            nameof(ApplicationUser),
            user.Id,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            newValues: $"{{\"gdprConsent\":true,\"role\":\"{role}\"}}",
            ct: ct);

        await Send.ResponseAsync(new RegisterResponse
        {
            UserId = user.Id,
            Email = user.Email!,
            Message = "Registration successful."
        }, StatusCodes.Status201Created, ct);
    }
}
