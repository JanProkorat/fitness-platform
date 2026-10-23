using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Authorization;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Professionals.Avatar;

/// <summary>
/// Persists the avatar blob URL on the calling professional's own profile record.
/// Ownership is guaranteed by scoping the route to <c>/professionals/me/...</c> — the caller
/// can only ever set their own professional avatar. The blobUrl itself is additionally
/// validated against the caller's identity-scoped unique key (see <see cref="AvatarBlobKeys"/> and
/// <see cref="IImageUploadService.IsValidBlobUrlForSubPath"/>) so an attacker cannot persist
/// an arbitrary or foreign URL that would later be rendered to other users.
/// </summary>
/// <param name="db">Database context.</param>
/// <param name="imageUpload">Image upload service — validates the blobUrl matches the caller's presigned key.</param>
/// <param name="blobStorage">Blob storage — removes the replaced avatar after the new one is saved.</param>
/// <param name="logger">Logger.</param>
[RemovedCoachRole(RemovedCoachRoleMode.Exempt, Reason = "The coach's own avatar stays editable while no coach role is active.")]
public class ConfirmProfessionalAvatarEndpoint(
    IApplicationDbContext db,
    IImageUploadService imageUpload,
    IBlobStorageService blobStorage,
    ILogger<ConfirmProfessionalAvatarEndpoint> logger)
    : Endpoint<ConfirmProfessionalAvatarRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/professionals/me/avatar");
        Roles(AppRoles.TrainerOrNutritionist);
        Summary(s =>
        {
            s.Summary = "Confirm professional avatar upload";
            s.Description = "Sets the AvatarBlobUrl on the caller's professional profile after a successful blob upload. "
                            + "Pass the blobUrl returned by POST /professionals/me/avatar/upload-url.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(ConfirmProfessionalAvatarRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var callerUserId = Guid.Parse(userId);

        var profile = await db.ProfessionalProfiles
            .FirstOrDefaultAsync(p => p.UserId == callerUserId, ct);

        if (profile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Reject any blobUrl that isn't exactly the identity-scoped presigned key issued by
        // POST /professionals/me/avatar/upload-url for this caller's profile. Without this
        // check an attacker could persist an arbitrary external URL that gets rendered to
        // other users (stored-content injection). This cannot live in the validator — it has
        // no access to the caller's DB-resolved ProfessionalProfile.Id.
        if (!AvatarBlobKeys.TryParseProfessionalKey(req.BlobUrl, profile.Id, out var key)
            || !imageUpload.IsValidBlobUrlForSubPath(ImageUploadScope.Avatar, key, req.BlobUrl))
        {
            await this.SendProblemAsync(400, ErrorCodes.InvalidBlobUrl,
                "BlobUrl does not match your avatar upload key.", ct);
            return;
        }

        var previousBlobUrl = profile.AvatarBlobUrl;

        profile.AvatarBlobUrl = req.BlobUrl;
        await db.SaveChangesAsync(ct);

        if (previousBlobUrl != req.BlobUrl)
        {
            await DeletePreviousBlobAsync(previousBlobUrl, profile.Id, ct);
        }

        await Send.NoContentAsync(ct);
    }

    // Removes the replaced blob once the new URL is saved. Only a name matching this profile's own
    // avatar pattern is deleted, and the path is rebuilt from that name, never taken from the URL.
    private async Task DeletePreviousBlobAsync(string? previousBlobUrl, long profileId, CancellationToken ct)
    {
        if (!AvatarBlobKeys.TryGetOwnedProfessionalSegment(previousBlobUrl, profileId, out var segment))
        {
            return;
        }

        try
        {
            await blobStorage.DeleteAsync($"avatars/{segment}", ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to delete previous avatar blob of professional profile {ProfileId}", profileId);
        }
    }
}
