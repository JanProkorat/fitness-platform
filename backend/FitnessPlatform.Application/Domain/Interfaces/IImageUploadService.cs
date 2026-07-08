using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Validates and generates pre-signed upload URLs for image assets.
///
/// <para>
/// This service is the single gateway for all image uploads across the platform.
/// It enforces a content-type whitelist and a maximum file size, then delegates
/// the signed-URL generation to <see cref="IBlobStorageService"/>.
/// </para>
///
/// <para><b>Blob-path conventions by scope:</b></para>
/// <list type="bullet">
///   <item><description><see cref="ImageUploadScope.Avatar"/>    — <c>avatars/{userId}.{ext}</c></description></item>
///   <item><description><see cref="ImageUploadScope.Food"/>      — <c>foods/{foodId}.{ext}</c></description></item>
///   <item><description><see cref="ImageUploadScope.Recipe"/>    — <c>recipes/{recipeId}/{slot}.{ext}</c></description></item>
///   <item><description><see cref="ImageUploadScope.PlanPhoto"/> — <c>plan-photos/{planId}/{photoId}.{ext}</c></description></item>
///   <item><description><see cref="ImageUploadScope.Diary"/>     — <c>diary/{diaryId}/{photoId}.{ext}</c></description></item>
/// </list>
///
/// <para>
/// The <c>subPath</c> argument on
/// <see cref="GenerateUploadUrlAsync(ImageUploadScope,string,string,long,CancellationToken)"/>
/// carries the scope-specific portion of the path that follows the scope prefix.
/// The service prepends the correct root segment automatically.
/// </para>
/// </summary>
public interface IImageUploadService
{
    /// <summary>
    /// Validates the content type and declared size, then returns a pre-signed PUT URL
    /// for direct client upload together with the permanent blob URL.
    ///
    /// <para><b>Allowed content types:</b> <c>image/jpeg</c>, <c>image/png</c>, <c>image/webp</c>.</para>
    /// <para><b>Maximum file size:</b> 5 MiB (5 × 1024 × 1024 bytes).</para>
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
    /// <param name="scope">
    /// Logical bucket scope that determines the blob-path prefix
    /// (e.g. <see cref="ImageUploadScope.Avatar"/> yields <c>avatars/…</c>).
    /// </param>
    /// <param name="subPath">
    /// The scope-specific portion of the path after the prefix, without a
    /// leading slash. Callers are responsible for constructing this from their
    /// domain identifiers according to the conventions listed above.
    /// Examples: <c>"{userId}.jpg"</c> for avatars,
    /// <c>"{recipeId}/cover.jpg"</c> for recipes.
    /// </param>
    /// <param name="contentType">
    /// MIME type declared by the client (e.g. <c>"image/jpeg"</c>).
    /// Must be one of the allowed types or a validation error is thrown.
    /// </param>
    /// <param name="sizeBytes">
    /// Declared file size in bytes. Must not exceed 5 MiB or a validation error is thrown.
    /// </param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>
    /// A <see cref="BlobUploadUrl"/> with the time-limited upload URL and the
    /// permanent blob URL at which the image will be accessible after upload.
    /// </returns>
    /// <exception cref="FastEndpoints.ValidationFailureException">
    /// Thrown with error code <c>INVALID_IMAGE_CONTENT_TYPE</c> when the content type is not
    /// in the whitelist, or <c>IMAGE_TOO_LARGE</c> when <paramref name="sizeBytes"/>
    /// exceeds the limit, or <c>INVALID_IMAGE_SUB_PATH</c> when <paramref name="subPath"/>
    /// is null, empty, whitespace, or contains path-traversal sequences (<c>..</c>, <c>\</c>,
    /// or a leading <c>/</c>).
    /// </exception>
    Task<BlobUploadUrl> GenerateUploadUrlAsync(
        ImageUploadScope scope,
        string subPath,
        string contentType,
        long sizeBytes,
        CancellationToken ct);

    /// <summary>
    /// Validates that <paramref name="blobUrl"/> is exactly the URL this service would have
    /// issued via <see cref="GenerateUploadUrlAsync(ImageUploadScope,string,string,long,CancellationToken)"/>
    /// for the given scope and identity-bound sub-path prefix, for one of the allowed image
    /// extensions.
    ///
    /// <para>
    /// Confirm-style endpoints receive an already-authenticated identity (a userId claim or a
    /// DB-resolved profile), not a raw request DTO — so this check cannot live in a
    /// <c>FluentValidation</c> validator, which has no access to the caller's identity. Call
    /// this from the endpoint's <c>HandleAsync</c> after resolving the caller's identity, and
    /// reject the request before persisting <paramref name="blobUrl"/> if it returns false.
    /// This closes the stored-content-injection hole where an attacker submits an arbitrary
    /// or another user's URL to be persisted verbatim and later rendered to other users.
    /// </para>
    /// </summary>
    /// <param name="scope">Logical bucket scope (e.g. <see cref="ImageUploadScope.Avatar"/>).</param>
    /// <param name="subPathPrefix">
    /// The scope-specific, extension-less portion of the expected key — e.g. <c>"{userId}"</c>
    /// for a user avatar or <c>"prof-{profileId}"</c> for a professional avatar. Must match
    /// exactly what the paired <c>GenerateUploadUrlEndpoint</c> used to build its <c>subPath</c>.
    /// </param>
    /// <param name="blobUrl">The blobUrl the caller is attempting to persist.</param>
    /// <returns>
    /// True only if <paramref name="blobUrl"/> matches <c>"{prefix}/{subPathPrefix}.{ext}"</c>
    /// (reconstructed via the same public-URL builder used at upload-url generation time) for
    /// one of the allowed image extensions. False for a null/empty/whitespace input, a
    /// mismatched prefix, or a foreign/external URL.
    /// </returns>
    bool IsValidBlobUrlForSubPath(ImageUploadScope scope, string subPathPrefix, string blobUrl);
}
