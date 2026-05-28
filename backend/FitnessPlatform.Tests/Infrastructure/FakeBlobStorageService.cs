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

    /// <inheritdoc />
    public Task UploadAsync(string containerPath, byte[] data, string contentType, CancellationToken ct)
    {
        // Record the upload so tests can assert it was called.
        UploadedPaths.Add(containerPath);
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public Task<bool> ObjectExistsAsync(string containerPath, CancellationToken ct)
    {
        // An object "exists" in the fake if it was previously uploaded via UploadAsync.
        return Task.FromResult(UploadedPaths.Contains(containerPath));
    }

    /// <inheritdoc />
    public Task DeleteAsync(string containerPath, CancellationToken ct)
    {
        // No-op in tests — deletion is silent.
        DeletedPaths.Add(containerPath);
        return Task.CompletedTask;
    }

    /// <summary>
    /// Paths passed to <see cref="UploadAsync"/> during the test run.
    /// Tests can assert against this list to verify blob upload was requested.
    /// </summary>
    public List<string> UploadedPaths { get; } = [];

    /// <summary>
    /// Paths passed to <see cref="DeleteAsync"/> during the test run.
    /// Tests can assert against this list to verify blob deletion was requested.
    /// </summary>
    public List<string> DeletedPaths { get; } = [];
}
