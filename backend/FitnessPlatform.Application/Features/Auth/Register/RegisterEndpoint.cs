using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;

namespace FitnessPlatform.Application.Features.Auth.Register;

/// <summary>
/// Endpoint for registering a new user account.
/// </summary>
/// <param name="userManager">ASP.NET Identity user manager.</param>
/// <param name="dbContext">Database context.</param>
/// <param name="audit">Audit logging service.</param>
/// <param name="tokenService">Shared email-verification token issuance service (see #679).</param>
/// <param name="logger">Logger for non-fatal send failures.</param>
public class RegisterEndpoint(UserManager<ApplicationUser> userManager, IApplicationDbContext dbContext, IAuditService audit, IEmailVerificationTokenService tokenService, ILogger<RegisterEndpoint> logger) : Endpoint<RegisterRequest, RegisterResponse>
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
            s.Response<RegisterResponse>(201, "Registration successful");
            s.Responses[400] = "Validation error";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(RegisterRequest req, CancellationToken ct)
    {
        var nowUtc = DateTime.UtcNow;
        var isClient = req.Roles.Any(r => string.Equals(r, "Client", StringComparison.OrdinalIgnoreCase));

        var user = new ApplicationUser
        {
            UserName = req.Email,
            Email = req.Email,
            FirstName = req.FirstName,
            LastName = req.LastName,
            GdprConsent = req.GdprConsent,
            GdprConsentDate = nowUtc,
            // Art. 9 health-data consent: set for clients only; coaches stay null.
            HealthDataConsent = isClient ? req.HealthDataConsent : null,
            HealthDataConsentDate = isClient && req.HealthDataConsent == true ? nowUtc : null
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

        var roles = req.Roles.Select(r => Enum.Parse<UserRole>(r, ignoreCase: true)).Distinct().ToList();
        await userManager.AddToRolesAsync(user, roles.Select(r => r.ToString()));

        // Create role-specific profiles
        if (roles.Any(r => r == UserRole.Trainer || r == UserRole.Nutritionist))
        {
            dbContext.ProfessionalProfiles.Add(new ProfessionalProfile { UserId = user.Id });
        }

        if (roles.Contains(UserRole.Client))
        {
            dbContext.ClientProfiles.Add(new ClientProfile { UserId = user.Id });
        }

        // Persist the user + role profiles before issuing the verification token so the
        // account exists even if the token issuance/send step below fails.
        await dbContext.SaveChangesAsync(ct);

        // Issue + send the verification email via the shared token service (#679) —
        // non-fatal: if the send fails the user is already created and can re-trigger
        // sending via /auth/resend-verification (or the anonymous resend endpoint).
        var language = HttpContext.Request.Headers.AcceptLanguage.FirstOrDefault() ?? "en";
        try
        {
            await tokenService.IssueAndSendAsync(user, language, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex,
                "Failed to send verification email to {Email} during registration. User {UserId} created; they can request a resend.",
                user.Email, user.Id);
        }

        // Audit: GDPR consent recorded at registration (includes Art. 9 health-data consent for clients)
        var healthDataConsentValue = user.HealthDataConsent.HasValue
            ? (user.HealthDataConsent.Value ? "true" : "false")
            : "null";
        await audit.LogAsync(
            user.Id,
            "Register",
            nameof(ApplicationUser),
            user.Id,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            newValues: $"{{\"gdprConsent\":true,\"healthDataConsent\":{healthDataConsentValue},\"roles\":[{string.Join(",", roles.Select(r => $"\"{r}\""))}]}}",
            ct: ct);

        await Send.ResponseAsync(new RegisterResponse
        {
            UserId = user.Id,
            Email = user.Email!,
            Message = "Registration successful."
        }, StatusCodes.Status201Created, ct);
    }
}
