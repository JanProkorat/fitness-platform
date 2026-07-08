using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using Microsoft.AspNetCore.Identity;

namespace FitnessPlatform.Application.Features.Users.Avatar;

/// <summary>
/// Persists the avatar blob URL on the caller's own user record.
/// Ownership is guaranteed by scoping the route to <c>/users/me/...</c> — the caller
/// can only ever set their own avatar. The blobUrl itself is additionally validated
/// against the caller's identity-scoped presigned key (see
/// <see cref="IImageUploadService.IsValidBlobUrlForSubPath"/>) so an attacker cannot
/// persist an arbitrary or foreign URL that would later be rendered to other users.
/// </summary>
/// <param name="userManager">ASP.NET Identity user manager.</param>
/// <param name="imageUpload">Image upload service — validates the blobUrl matches the caller's presigned key.</param>
public class ConfirmAvatarEndpoint(UserManager<ApplicationUser> userManager, IImageUploadService imageUpload)
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

        // Reject any blobUrl that isn't exactly the identity-scoped presigned key issued by
        // POST /users/me/avatar/upload-url for this caller. Without this check an attacker
        // could persist an arbitrary external URL that gets rendered to other users
        // (stored-content injection). This cannot live in the validator — it has no access
        // to the caller's userId claim.
        if (!imageUpload.IsValidBlobUrlForSubPath(ImageUploadScope.Avatar, userId, req.BlobUrl))
        {
            await this.SendProblemAsync(400, ErrorCodes.InvalidBlobUrl,
                "BlobUrl does not match your avatar upload key.", ct);
            return;
        }

        user.AvatarBlobUrl = req.BlobUrl;
        user.DateUpdated = DateTime.UtcNow;

        await userManager.UpdateAsync(user);

        await Send.NoContentAsync(ct);
    }
}
