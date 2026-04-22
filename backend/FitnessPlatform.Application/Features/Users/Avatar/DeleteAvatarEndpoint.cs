using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using Microsoft.AspNetCore.Identity;

namespace FitnessPlatform.Application.Features.Users.Avatar;

/// <summary>
/// Removes the avatar from the caller's user record.
/// </summary>
/// <param name="userManager">ASP.NET Identity user manager.</param>
public class DeleteAvatarEndpoint(UserManager<ApplicationUser> userManager)
    : EndpointWithoutRequest
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/users/me/avatar");
        Summary(s =>
        {
            s.Summary = "Delete avatar";
            s.Description = "Clears the AvatarBlobUrl on the caller's user record.";
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

        user.AvatarBlobUrl = null;
        user.DateUpdated = DateTime.UtcNow;

        await userManager.UpdateAsync(user);

        await Send.NoContentAsync(ct);
    }
}
