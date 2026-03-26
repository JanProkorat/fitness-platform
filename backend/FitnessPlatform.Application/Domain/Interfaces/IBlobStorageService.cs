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
}

/// <summary>
/// Result of generating a pre-signed upload URL.
/// </summary>
/// <param name="UploadUrl">The pre-signed URL the client should PUT the file to.</param>
/// <param name="BlobUrl">The permanent URL where the blob will be accessible after upload.</param>
public record BlobUploadUrl(string UploadUrl, string BlobUrl);
