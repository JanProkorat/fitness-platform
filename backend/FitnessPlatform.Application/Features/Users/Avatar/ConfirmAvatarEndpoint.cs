using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
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
/// <param name="blobStorage">Blob storage — removes the replaced avatar after the new one is saved.</param>
/// <param name="logger">Logger.</param>
public class ConfirmAvatarEndpoint(
    UserManager<ApplicationUser> userManager,
    IImageUploadService imageUpload,
    IBlobStorageService blobStorage,
    ILogger<ConfirmAvatarEndpoint> logger)
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
        if (!AvatarBlobKeys.TryParseUserKey(req.BlobUrl, user.Id, out var key)
            || !imageUpload.IsValidBlobUrlForSubPath(ImageUploadScope.Avatar, key, req.BlobUrl))
        {
            await this.SendProblemAsync(400, ErrorCodes.InvalidBlobUrl,
                "BlobUrl does not match your avatar upload key.", ct);
            return;
        }

        var previousBlobUrl = user.AvatarBlobUrl;

        user.AvatarBlobUrl = req.BlobUrl;
        user.DateUpdated = DateTime.UtcNow;

        var result = await userManager.UpdateAsync(user);

        if (result.Succeeded && previousBlobUrl != req.BlobUrl)
        {
            await DeletePreviousBlobAsync(previousBlobUrl, user.Id, ct);
        }

        await Send.NoContentAsync(ct);
    }

    // Removes the replaced blob once the new URL is saved. Only a name matching this user's own
    // avatar pattern is deleted, and the path is rebuilt from that name, never taken from the URL.
    private async Task DeletePreviousBlobAsync(string? previousBlobUrl, Guid userId, CancellationToken ct)
    {
        if (!AvatarBlobKeys.TryGetOwnedUserSegment(previousBlobUrl, userId, out var segment))
        {
            return;
        }

        try
        {
            await blobStorage.DeleteAsync($"avatars/{segment}", ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to delete previous avatar blob of user {UserId}", userId);
        }
    }
}
