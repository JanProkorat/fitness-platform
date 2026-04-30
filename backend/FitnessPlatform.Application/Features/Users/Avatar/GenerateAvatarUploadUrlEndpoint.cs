using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;

namespace FitnessPlatform.Application.Features.Users.Avatar;

/// <summary>
/// Generates a pre-signed URL for the caller to upload their own avatar directly to blob storage.
/// </summary>
/// <param name="imageUpload">Image upload service — validates content type and size, then issues the signed URL.</param>
public class GenerateAvatarUploadUrlEndpoint(IImageUploadService imageUpload)
    : Endpoint<GenerateAvatarUploadUrlRequest, GenerateAvatarUploadUrlResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/users/me/avatar/upload-url");
        Summary(s =>
        {
            s.Summary = "Generate avatar upload URL";
            s.Description = "Returns a time-limited pre-signed URL for direct avatar upload to blob storage, "
                            + "together with the permanent blob URL that should be confirmed via PUT /users/me/avatar.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(GenerateAvatarUploadUrlRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var extension = GetExtension(req.ContentType);
        var subPath = $"{userId}.{extension}";

        var result = await imageUpload.GenerateUploadUrlAsync(
            ImageUploadScope.Avatar,
            subPath,
            req.ContentType,
            req.SizeBytes,
            ct);

        await Send.OkAsync(new GenerateAvatarUploadUrlResponse
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
        "image/heic" => "heic",
        "image/heif" => "heif",
        _ => "bin",
    };
}
