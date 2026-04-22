using FitnessPlatform.Application.Domain.Interfaces;

namespace FitnessPlatform.Tests.Infrastructure;

/// <summary>
/// In-memory stub for <see cref="IBlobStorageService"/> used in integration tests.
/// Returns deterministic, fake upload URLs so tests never need a real MinIO instance.
/// </summary>
public class FakeBlobStorageService : IBlobStorageService
{
    /// <inheritdoc />
    public Task<BlobUploadUrl> GenerateUploadUrlAsync(
        string containerPath,
        string contentType,
        TimeSpan expiresIn,
        CancellationToken ct)
    {
        // Return a stable, recognisable fake URL.  The containerPath is exactly
        // what the real service would store (e.g. "foods/{foodId}.jpg") so
        // integration tests can assert both the upload URL and the blob URL.
        var uploadUrl = $"https://fake-storage/upload/{containerPath}?token=test";
        var blobUrl = containerPath;
        return Task.FromResult(new BlobUploadUrl(uploadUrl, blobUrl));
    }
}
