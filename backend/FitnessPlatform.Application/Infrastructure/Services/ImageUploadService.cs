using FastEndpoints;
using FluentValidation.Results;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// Validates image uploads and delegates signed-URL generation to
/// <see cref="IBlobStorageService"/>.
///
/// <para><b>Allowed content types:</b> <c>image/jpeg</c>, <c>image/png</c>, <c>image/webp</c>.</para>
/// <para><b>Maximum file size:</b> <see cref="MaxImageSizeBytes"/> (5 MiB).</para>
///
/// <para><b>Blob-path conventions by scope:</b></para>
/// <list type="bullet">
///   <item><description><see cref="ImageUploadScope.Avatar"/>    — <c>avatars/{userId}.{ext}</c></description></item>
///   <item><description><see cref="ImageUploadScope.Food"/>      — <c>foods/{foodId}.{ext}</c></description></item>
///   <item><description><see cref="ImageUploadScope.Recipe"/>    — <c>recipes/{recipeId}/{slot}.{ext}</c></description></item>
///   <item><description><see cref="ImageUploadScope.PlanPhoto"/> — <c>plan-photos/{planId}/{photoId}.{ext}</c></description></item>
///   <item><description><see cref="ImageUploadScope.Diary"/>     — <c>diary/{diaryId}/{photoId}.{ext}</c></description></item>
/// </list>
/// </summary>
public class ImageUploadService(IBlobStorageService blobStorage) : IImageUploadService
{
    /// <summary>Maximum allowed image file size: 5 MiB.</summary>
    public const long MaxImageSizeBytes = 5L * 1024 * 1024;

    private static readonly IReadOnlyDictionary<string, string> AllowedContentTypes =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["image/jpeg"] = "jpg",
            ["image/png"] = "png",
            ["image/webp"] = "webp",
        };

    /// <summary>Pre-signed URL validity window for image uploads.</summary>
    private static readonly TimeSpan UploadUrlExpiry = TimeSpan.FromMinutes(15);

    /// <inheritdoc />
    /// <remarks>
    /// Blob-path conventions by scope:
    /// <list type="bullet">
    ///   <item><description>Avatar    — <c>avatars/{userId}.{ext}</c></description></item>
    ///   <item><description>Food      — <c>foods/{foodId}.{ext}</c></description></item>
    ///   <item><description>Recipe    — <c>recipes/{recipeId}/{slot}.{ext}</c></description></item>
    ///   <item><description>PlanPhoto — <c>plan-photos/{planId}/{photoId}.{ext}</c></description></item>
    ///   <item><description>Diary     — <c>diary/{diaryId}/{photoId}.{ext}</c></description></item>
    /// </list>
    /// </remarks>
    /// <exception cref="ValidationFailureException">
    /// Also thrown with error code <c>INVALID_IMAGE_SUB_PATH</c> when <paramref name="subPath"/>
    /// is null, empty, or contains path-traversal sequences (<c>..</c>, <c>\</c>, or a leading <c>/</c>).
    /// </exception>
    public async Task<BlobUploadUrl> GenerateUploadUrlAsync(
        ImageUploadScope scope,
        string subPath,
        string contentType,
        long sizeBytes,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(subPath) ||
            subPath.Contains("..", StringComparison.Ordinal) ||
            subPath.StartsWith('/') ||
            subPath.Contains('\\', StringComparison.Ordinal))
        {
            var failures = new List<ValidationFailure>
            {
                new(nameof(subPath), "Invalid blob sub-path.")
                {
                    ErrorCode = ErrorCodes.InvalidImageSubPath
                }
            };
            throw new ValidationFailureException(failures, "Invalid blob sub-path.");
        }

        if (!AllowedContentTypes.TryGetValue(contentType, out _))
        {
            var allowed = string.Join(", ", AllowedContentTypes.Keys);
            var failures = new List<ValidationFailure>
            {
                new("contentType", $"Content type must be one of: {allowed}.")
                {
                    ErrorCode = ErrorCodes.InvalidImageContentType
                }
            };
            throw new ValidationFailureException(failures, "Invalid image content type.");
        }

        if (sizeBytes > MaxImageSizeBytes)
        {
            var limitMb = MaxImageSizeBytes / (1024 * 1024);
            var failures = new List<ValidationFailure>
            {
                new("sizeBytes", $"Image must not exceed {limitMb} MB.")
                {
                    ErrorCode = ErrorCodes.ImageTooLarge
                }
            };
            throw new ValidationFailureException(failures, "Image exceeds maximum allowed size.");
        }

        var prefix = ScopeToPrefix(scope);
        var containerPath = $"{prefix}/{subPath}";

        return await blobStorage.GenerateUploadUrlAsync(
            containerPath,
            contentType,
            UploadUrlExpiry,
            ct);
    }

    private static string ScopeToPrefix(ImageUploadScope scope) => scope switch
    {
        ImageUploadScope.Avatar    => "avatars",
        ImageUploadScope.Food      => "foods",
        ImageUploadScope.Recipe    => "recipes",
        ImageUploadScope.PlanPhoto => "plan-photos",
        ImageUploadScope.Diary     => "diary",
        _                          => throw new ArgumentOutOfRangeException(nameof(scope), scope, null)
    };
}
