namespace FitnessPlatform.Application.Domain.Interfaces;

/// <summary>
/// Abstraction for blob storage operations (MinIO in dev, Azure Blob in prod).
/// </summary>
public interface IBlobStorageService
{
    /// <summary>
    /// Generates a time-limited pre-signed URL for direct client upload to blob storage.
    /// </summary>
    /// <param name="containerPath">The container/bucket path including the object key (e.g. "exercises/videos/{id}.mp4").</param>
    /// <param name="contentType">The expected content type of the upload (e.g. "video/mp4").</param>
    /// <param name="expiresIn">How long the upload URL remains valid.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>A <see cref="BlobUploadUrl"/> containing the upload URL and the final blob URL.</returns>
    Task<BlobUploadUrl> GenerateUploadUrlAsync(string containerPath, string contentType, TimeSpan expiresIn, CancellationToken ct);

    /// <summary>
    /// Builds the deterministic blob-reference URL for a given container path, using the exact
    /// same construction logic as <see cref="GenerateUploadUrlAsync"/> — without generating a
    /// new pre-signed upload URL or making a network call.
    ///
    /// <para>
    /// <b>This value is no longer directly fetchable for client-photo prefixes</b>
    /// (<c>plan-photos/</c>, <c>diary/</c>) once <c>ManageBucket=true</c> — the bucket's
    /// public-read grant only covers catalog/profile prefixes (avatars, foods, recipes,
    /// exercise videos). What this method returns is a stable identity used two ways: (1) as
    /// the persisted "BlobUrl" anchor on photo rows, later converted to a short-lived readable
    /// URL by <see cref="GenerateReadUrlAsync"/>, and (2) by confirm-style endpoints to validate
    /// a client-supplied blobUrl by reconstructing the value this service would have issued for
    /// a known, identity-scoped container path, rather than parsing the caller's URL (which
    /// would duplicate the host/bucket concatenation logic and drift from it over time).
    /// </para>
    /// </summary>
    /// <param name="containerPath">The container/bucket path including the object key.</param>
    /// <returns>The same URL string that <see cref="GenerateUploadUrlAsync"/> would return as <c>BlobUrl</c> for that path.</returns>
    string BuildPublicUrl(string containerPath);

    /// <summary>
    /// Converts a blob-reference URL previously returned by <see cref="BuildPublicUrl"/> /
    /// <see cref="GenerateUploadUrlAsync"/> — and persisted verbatim on a photo/document row —
    /// into a fresh, short-lived pre-signed GET URL using the configured
    /// <c>MinIO:ReadUrlExpiryMinutes</c> validity window (default 15 minutes).
    ///
    /// <para>
    /// The bucket carries no public-read grant for client-photo prefixes (<c>plan-photos/</c>,
    /// <c>diary/</c>), so this is the ONLY way a stored blob URL for a client's progress, meal,
    /// or session photo resolves to fetchable image bytes. Every response DTO that surfaces one
    /// of those stored URLs MUST pass it through this method before sending — never emit the
    /// stored value directly.
    /// </para>
    ///
    /// <para>
    /// <b>Fails CLOSED, not open.</b> Returns the input unchanged only for a <c>null</c>/empty
    /// <paramref name="storedBlobUrl"/> (nothing to sign). When <paramref name="storedBlobUrl"/>
    /// is non-empty but does not match this service's own URL shape — a foreign value, or a row
    /// written before <c>MinIO:PublicEndpoint</c> / <c>MinIO:BucketName</c> /
    /// <c>MinIO:PublicUrlIncludesBucket</c> changed — this returns <see cref="string.Empty"/>,
    /// NEVER the permanent stored value. Callers MUST NOT fall back to the stored value with
    /// <c>?? storedBlobUrl</c> on a null/empty result: doing so hands the caller the permanent
    /// unsigned URL this method exists to replace and silently reopens F9 for every photo the
    /// moment extraction fails. Use <c>?? string.Empty</c> instead — the resulting broken image
    /// is visible and diagnosable, unlike a silently-restored permanent URL.
    /// </para>
    /// </summary>
    /// <param name="storedBlobUrl">The blob URL previously persisted on the photo/document row.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>
    /// A short-lived pre-signed GET URL; the input unchanged only when it was null/empty;
    /// otherwise <see cref="string.Empty"/> when the value cannot be re-signed.
    /// </returns>
    Task<string?> GenerateReadUrlAsync(string? storedBlobUrl, CancellationToken ct);

    /// <summary>
    /// Normalizes a client-submitted blob URL to the exact canonical form this service persists
    /// (the same value <see cref="BuildPublicUrl"/> would produce for the underlying container
    /// path) — strips a pre-signed query string when present, then re-derives the value from the
    /// CURRENT <c>MinIO:PublicEndpoint</c> / <c>MinIO:BucketName</c> / <c>MinIO:PublicUrlIncludesBucket</c>
    /// configuration.
    ///
    /// <para>
    /// Write paths that accept a client-submitted <c>BlobUrl</c> MUST call this before persisting
    /// it. A client may echo back the short-lived read URL <see cref="GenerateReadUrlAsync"/>
    /// issued (or, from an app build that predates the identity/presentation split, a value that
    /// used to BE the signed URL before it was split into a separate display field) — without
    /// normalization, the signature's query string becomes the permanently stored value, and
    /// once the signature lapses <see cref="GenerateReadUrlAsync"/> can no longer resolve the row
    /// back to a container path (F9 follow-up). Normalizing to the SAME canonical value the row
    /// already has (rather than rejecting the submission outright) means a re-save that echoes a
    /// signed URL updates the existing row in place instead of appearing as a new, unrecognized
    /// one under REPLACE-semantics endpoints.
    /// </para>
    /// </summary>
    /// <param name="blobUrl">The client-submitted blob URL to normalize.</param>
    /// <returns>
    /// The canonical stored form, or <c>null</c> when <paramref name="blobUrl"/> is null/empty or
    /// does not match this service's own URL shape at all — a genuinely foreign value the caller
    /// must reject rather than persist.
    /// </returns>
    string? NormalizeToCanonicalUrl(string blobUrl);

    /// <summary>
    /// Uploads raw bytes directly to blob storage (server-side upload).
    /// Used by seed runners and background jobs that have the bytes in memory
    /// and do not need a client-facing pre-signed URL.
    /// Idempotent: re-uploading the same key replaces the existing object.
    /// </summary>
    /// <param name="containerPath">The container/bucket path including the object key.</param>
    /// <param name="data">Raw bytes to store.</param>
    /// <param name="contentType">MIME type of the object (e.g. "image/png").</param>
    /// <param name="ct">Cancellation token.</param>
    Task UploadAsync(string containerPath, byte[] data, string contentType, CancellationToken ct);

    /// <summary>
    /// Returns true if an object exists at the given container path, false otherwise.
    /// </summary>
    /// <param name="containerPath">The container/bucket path including the object key.</param>
    /// <param name="ct">Cancellation token.</param>
    Task<bool> ObjectExistsAsync(string containerPath, CancellationToken ct);

    /// <summary>
    /// Deletes a blob from storage by its full container path (e.g. "plan-photos/{planId}/{guid}.jpg").
    /// No-ops silently if the object does not exist.
    /// </summary>
    /// <param name="containerPath">The container/bucket path including the object key.</param>
    /// <param name="ct">Cancellation token.</param>
    Task DeleteAsync(string containerPath, CancellationToken ct);
}

/// <summary>
/// Result of generating a pre-signed upload URL.
/// </summary>
/// <param name="UploadUrl">The pre-signed URL the client should PUT the file to.</param>
/// <param name="BlobUrl">The permanent URL where the blob will be accessible after upload.</param>
public record BlobUploadUrl(string UploadUrl, string BlobUrl);
