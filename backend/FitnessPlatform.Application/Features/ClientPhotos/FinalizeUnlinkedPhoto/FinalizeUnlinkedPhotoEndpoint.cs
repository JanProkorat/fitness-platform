using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Extensions;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.ClientPhotos.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FitnessPlatform.Application.Features.ClientPhotos.FinalizeUnlinkedPhoto;

/// <summary>
/// Finalizes a progress photo upload that belongs to no plan by inserting a <see cref="PlanPhoto"/>
/// row with no plan, type or link. The blob must sit under
/// <c>plan-photos/unlinked/{callerUserId}/</c>; any other prefix is rejected so a client cannot
/// register another user's blob. Coaches with a live link at upload time can see the photo through
/// the viewer rows written here.
/// </summary>
/// <param name="db">Relational database context for profile lookup and photo insert.</param>
/// <param name="logger">Logger.</param>
/// <param name="blobStorage">Blob storage service — canonicalizes the submitted URL and signs the response URL.</param>
public class FinalizeUnlinkedPhotoEndpoint(
    IApplicationDbContext db,
    ILogger<FinalizeUnlinkedPhotoEndpoint> logger,
    IBlobStorageService blobStorage)
    : Endpoint<FinalizeUnlinkedPhotoRequest, PlanPhotoResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/photos");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Finalize progress photo upload (no plan)";
            s.Description =
                "Inserts a PlanPhoto row with no plan after the client has PUT the blob to the pre-signed URL "
                + "from POST /client/photos/upload-url. Category must be Body or FreeForm. The blob must be "
                + "under plan-photos/unlinked/{userId}/ for the calling client.";
            s.Response<PlanPhotoResponse>(StatusCodes.Status201Created, "Progress photo finalized");
            s.Responses[StatusCodes.Status400BadRequest] = "Invalid request, or blob URL not under the caller's unlinked prefix";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status404NotFound] = "Caller has no client profile";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(FinalizeUnlinkedPhotoRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var callerUserId = Guid.Parse(userId);

        // Normalise to the canonical stored form, then bind the blob to the caller: the canonical URL
        // must start with the caller's own unlinked prefix and the remainder must be a bare file name.
        var canonicalBlobUrl = blobStorage.NormalizeToCanonicalUrl(req.BlobUrl);
        var callerPrefix = blobStorage.BuildPublicUrl($"plan-photos/unlinked/{callerUserId}/");

        if (canonicalBlobUrl is null
            || !canonicalBlobUrl.StartsWith(callerPrefix, StringComparison.Ordinal)
            || canonicalBlobUrl[callerPrefix.Length..].Contains('/', StringComparison.Ordinal))
        {
            await this.SendProblemAsync(400, ErrorCodes.InvalidBlobUrl,
                "Photo URL must be under the caller's unlinked photo storage prefix.", ct);
            return;
        }

        var clientProfile = await db.ClientProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(cp => cp.UserId == callerUserId, ct);

        if (clientProfile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var now = DateTime.UtcNow;

        var photo = new PlanPhoto
        {
            PublicId = Guid.NewGuid(),
            ClientProfileId = clientProfile.Id,
            Category = req.Category,
            BlobUrl = canonicalBlobUrl,
            Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim(),
            TakenAt = req.TakenAt ?? now,
            UploadedByUserId = callerUserId,
            DateCreated = now,
            DateUpdated = now
        };

        db.PlanPhotos.Add(photo);
        await PlanPhotoVisibilityWriter.AddViewersAsync(db, logger, [photo], null, ct);
        await db.SaveChangesAsync(ct);

        await Send.ResponseAsync(new PlanPhotoResponse
        {
            Id = photo.PublicId,
            BlobUrl = photo.BlobUrl,
            DisplayUrl = await blobStorage.GenerateReadUrlAsync(photo.BlobUrl, ct) ?? string.Empty,
            Category = photo.Category,
            Description = photo.Description,
            TakenAt = photo.TakenAt,
            DateCreated = photo.DateCreated,
            UploadedByUserId = photo.UploadedByUserId
        }, StatusCodes.Status201Created, ct);
    }
}
