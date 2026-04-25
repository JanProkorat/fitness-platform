using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.ClientPlans.DeletePlanPhoto;

/// <summary>
/// Deletes a plan photo. Only the user who uploaded the photo may delete it.
/// Professionals (trainers / nutritionists) cannot delete client photos.
/// Removes the DB row and the blob from storage.
/// </summary>
/// <param name="db">Relational database context.</param>
/// <param name="blobStorage">Blob storage service for deleting the physical blob.</param>
public class DeletePlanPhotoEndpoint(IApplicationDbContext db, IBlobStorageService blobStorage)
    : Endpoint<DeletePlanPhotoRequest>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Delete("/client/photos/{PhotoId}");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Delete plan photo";
            s.Description =
                "Deletes the plan photo identified by photoId. "
                + "Only the user who uploaded the photo may call this endpoint. "
                + "Returns 403 if the caller is not the uploader. "
                + "Removes both the database row and the blob from storage.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(DeletePlanPhotoRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var callerUserId = Guid.Parse(userId);

        var photo = await db.PlanPhotos
            .FirstOrDefaultAsync(p => p.PublicId == req.PhotoId, ct);

        if (photo is null)
        {
            await this.SendProblemAsync(404, ErrorCodes.PlanPhotoNotFound, "Photo not found.", ct);
            return;
        }

        // Ownership check: only the uploader may delete the photo.
        if (photo.UploadedByUserId != callerUserId)
        {
            await this.SendProblemAsync(403, ErrorCodes.PlanPhotoNotOwned,
                "Only the uploader can delete this photo.", ct);
            return;
        }

        // Derive the blob container path from the blob URL.
        // Stored as the full public URL (e.g. http://localhost:9000/fitness-platform/plan-photos/…)
        // or as a relative path (plan-photos/…) depending on the environment.
        // We try to extract the path starting at the scope prefix.
        var containerPath = ExtractContainerPath(photo.BlobUrl);

        db.PlanPhotos.Remove(photo);
        await db.SaveChangesAsync(ct);

        // Delete the blob after the DB row is removed so the record is gone
        // even if blob deletion fails (avoids orphaned DB rows).
        if (containerPath is not null)
        {
            await blobStorage.DeleteAsync(containerPath, ct);
        }

        await Send.NoContentAsync(ct);
    }

    /// <summary>
    /// Extracts the MinIO container path (e.g. "plan-photos/…") from a full blob URL or relative path.
    /// Returns null when the path cannot be determined — blob deletion is skipped in that case.
    /// </summary>
    private static string? ExtractContainerPath(string blobUrl)
    {
        if (string.IsNullOrWhiteSpace(blobUrl))
            return null;

        // If already a relative path (no scheme), use directly.
        if (!blobUrl.Contains("://"))
            return blobUrl;

        // Strip scheme + host + bucket: keep everything after the third slash.
        // e.g. "http://localhost:9000/fitness-platform/plan-photos/abc/def.jpg"
        //   → "plan-photos/abc/def.jpg"
        try
        {
            var uri = new Uri(blobUrl);
            // uri.AbsolutePath = "/fitness-platform/plan-photos/abc/def.jpg"
            // Strip the leading "/" and the bucket segment.
            var path = uri.AbsolutePath.TrimStart('/');
            var firstSlash = path.IndexOf('/', StringComparison.Ordinal);
            return firstSlash >= 0 ? path[(firstSlash + 1)..] : null;
        }
        catch
        {
            return null;
        }
    }
}
