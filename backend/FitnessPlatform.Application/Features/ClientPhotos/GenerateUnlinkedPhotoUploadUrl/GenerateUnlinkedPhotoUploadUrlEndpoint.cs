using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.ClientPhotos.GenerateUnlinkedPhotoUploadUrl;

/// <summary>
/// Generates a pre-signed URL for a client to upload a progress photo that belongs to no plan.
/// The blob lands under <c>plan-photos/unlinked/{callerUserId}/{guid}.{ext}</c> so the finalize
/// endpoint can bind the blob to the caller.
/// </summary>
/// <param name="imageUpload">Image upload service — validates content type and size, then issues the signed URL.</param>
/// <param name="db">Relational database context for client profile lookup.</param>
public class GenerateUnlinkedPhotoUploadUrlEndpoint(
    IImageUploadService imageUpload,
    IApplicationDbContext db)
    : Endpoint<GenerateUnlinkedPhotoUploadUrlRequest, GenerateUnlinkedPhotoUploadUrlResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/client/photos/upload-url");
        Roles(AppRoles.Client);
        Summary(s =>
        {
            s.Summary = "Generate progress photo upload URL (no plan)";
            s.Description =
                "Returns a time-limited pre-signed URL for direct upload of a progress photo that "
                + "belongs to no plan (plan-photos/unlinked/{userId}/{guid}.{ext}), together with the "
                + "permanent blob URL to pass to POST /client/photos.";
            s.Responses[StatusCodes.Status200OK] = "Upload URL and blob URL";
            s.Responses[StatusCodes.Status400BadRequest] = "Unsupported content type or invalid size";
            s.Responses[StatusCodes.Status401Unauthorized] = "Missing or unreadable caller claim";
            s.Responses[StatusCodes.Status404NotFound] = "Caller has no client profile";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GenerateUnlinkedPhotoUploadUrlRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var callerUserId = Guid.Parse(userId);

        var hasProfile = await db.ClientProfiles
            .AsNoTracking()
            .AnyAsync(cp => cp.UserId == callerUserId, ct);

        if (!hasProfile)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var result = await imageUpload.GenerateUploadUrlAsync(
            ImageUploadScope.PlanPhoto,
            $"unlinked/{callerUserId}/{Guid.NewGuid()}.{GetExtension(req.ContentType)}",
            req.ContentType,
            req.SizeBytes,
            ct);

        await Send.OkAsync(new GenerateUnlinkedPhotoUploadUrlResponse
        {
            UploadUrl = result.UploadUrl,
            BlobUrl = result.BlobUrl
        }, ct);
    }

    private static string GetExtension(string contentType) => contentType.ToLowerInvariant() switch
    {
        "image/jpeg" => "jpg",
        "image/png"  => "png",
        "image/webp" => "webp",
        "image/heic" => "heic",
        "image/heif" => "heif",
        // The validator rejects unknown content types before this point.
        _ => throw new InvalidOperationException($"Unsupported content type {contentType}"),
    };
}
