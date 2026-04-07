using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using Microsoft.AspNetCore.Identity;

namespace FitnessPlatform.Application.Features.Users.UpdateProfile;

/// <summary>
/// Endpoint for updating the authenticated user's profile information.
/// </summary>
/// <param name="userManager">ASP.NET Identity user manager.</param>
/// <param name="audit">Audit logging service.</param>
public class UpdateProfileEndpoint(UserManager<ApplicationUser> userManager, IAuditService audit) : Endpoint<UpdateProfileRequest>
{

    /// <inheritdoc />
    public override void Configure()
    {
        Put("/users/me");
        Summary(s =>
        {
            s.Summary = "Update current user profile";
            s.Description = "Updates the first name and last name of the currently authenticated user.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateProfileRequest req, CancellationToken ct)
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

        var oldFirstName = user.FirstName;
        var oldLastName = user.LastName;

        user.FirstName = req.FirstName;
        user.LastName = req.LastName;
        user.PhoneNumber = req.PhoneNumber;
        user.DateUpdated = DateTime.UtcNow;

        await userManager.UpdateAsync(user);

        // Audit: personal data modification
        await audit.LogAsync(
            user.Id,
            "Update",
            nameof(ApplicationUser),
            user.Id,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            oldValues: $"{{\"firstName\":\"{oldFirstName}\",\"lastName\":\"{oldLastName}\"}}",
            newValues: $"{{\"firstName\":\"{req.FirstName}\",\"lastName\":\"{req.LastName}\"}}",
            ct: ct);

        await Send.OkAsync(new { Message = "Profile updated successfully." }, ct);
    }
}
