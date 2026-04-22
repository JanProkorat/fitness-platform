using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace FitnessPlatform.Application.Features.Professionals.Avatar;

/// <summary>
/// Generates a pre-signed URL for the calling professional to upload their own avatar
/// directly to blob storage.
/// </summary>
/// <param name="imageUpload">Image upload service — validates content type and size, then issues the signed URL.</param>
/// <param name="db">Database context — used to resolve the caller's ProfessionalProfile.</param>
public class GenerateProfessionalAvatarUploadUrlEndpoint(
    IImageUploadService imageUpload,
    IApplicationDbContext db)
    : Endpoint<GenerateProfessionalAvatarUploadUrlRequest, GenerateProfessionalAvatarUploadUrlResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/professionals/me/avatar/upload-url");
        Roles(AppRoles.TrainerOrNutritionist);
        Summary(s =>
        {
            s.Summary = "Generate professional avatar upload URL";
            s.Description = "Returns a time-limited pre-signed URL for direct avatar upload to blob storage, "
                            + "together with the permanent blob URL that should be confirmed via PUT /professionals/me/avatar.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(
        GenerateProfessionalAvatarUploadUrlRequest req,
        CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var callerUserId = Guid.Parse(userId);

        var profile = await db.ProfessionalProfiles
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == callerUserId, ct);

        if (profile is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        var extension = GetExtension(req.ContentType);
        var subPath = $"prof-{profile.Id}.{extension}";

        var result = await imageUpload.GenerateUploadUrlAsync(
            ImageUploadScope.Avatar,
            subPath,
            req.ContentType,
            req.SizeBytes,
            ct);

        await Send.OkAsync(new GenerateProfessionalAvatarUploadUrlResponse
        {
            UploadUrl = result.UploadUrl,
            BlobUrl = result.BlobUrl
        }, ct);
    }

    // Returns a file extension for known image types.
    // For unsupported types, returns a placeholder — the IImageUploadService
    // validates the content type and will throw INVALID_IMAGE_CONTENT_TYPE before
    // the subPath value reaches blob storage.
    private static string GetExtension(string contentType) => contentType.ToLowerInvariant() switch
    {
        "image/jpeg" => "jpg",
        "image/png" => "png",
        "image/webp" => "webp",
        _ => "bin",
    };
}
