using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using Microsoft.AspNetCore.Identity;

namespace FitnessPlatform.Application.Features.Users.Avatar;

/// <summary>
/// Persists the avatar blob URL on the caller's own user record.
/// Ownership is guaranteed by scoping the route to <c>/users/me/...</c> — the caller
/// can only ever set their own avatar.
/// </summary>
/// <param name="userManager">ASP.NET Identity user manager.</param>
public class ConfirmAvatarEndpoint(UserManager<ApplicationUser> userManager)
    : Endpoint<ConfirmAvatarRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/users/me/avatar");
        Summary(s =>
        {
            s.Summary = "Confirm avatar upload";
            s.Description = "Sets the AvatarBlobUrl on the caller's user record after a successful blob upload. "
                            + "Pass the blobUrl returned by POST /users/me/avatar/upload-url.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(ConfirmAvatarRequest req, CancellationToken ct)
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

        user.AvatarBlobUrl = req.BlobUrl;
        user.DateUpdated = DateTime.UtcNow;

        await userManager.UpdateAsync(user);

        await Send.NoContentAsync(ct);
    }
}
