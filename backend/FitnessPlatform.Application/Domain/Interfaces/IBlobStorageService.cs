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
    /// Builds the public blob URL for a given container path, using the exact same
    /// construction logic as <see cref="GenerateUploadUrlAsync"/> — without generating a
    /// new pre-signed upload URL or making a network call.
    ///
    /// <para>
    /// Confirm-style endpoints use this to validate a client-supplied blobUrl by
    /// reconstructing the value this service would have issued for a known,
    /// identity-scoped container path, rather than parsing the caller's URL (which would
    /// duplicate the host/bucket concatenation logic and drift from it over time).
    /// </para>
    /// </summary>
    /// <param name="containerPath">The container/bucket path including the object key.</param>
    /// <returns>The same public URL string that <see cref="GenerateUploadUrlAsync"/> would return as <c>BlobUrl</c> for that path.</returns>
    string BuildPublicUrl(string containerPath);

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
