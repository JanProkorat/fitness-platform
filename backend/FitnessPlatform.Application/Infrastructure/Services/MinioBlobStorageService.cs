using FitnessPlatform.Application.Domain.Interfaces;
using Minio;
using Minio.DataModel.Args;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// MinIO implementation of <see cref="IBlobStorageService"/> for local development.
/// Generates pre-signed URLs for direct client uploads.
/// </summary>
public class MinioBlobStorageService : IBlobStorageService
{
    private readonly IMinioClient _client;
    private readonly string _bucketName;
    private readonly string _publicEndpoint;

    /// <summary>
    /// Initializes a new instance of <see cref="MinioBlobStorageService"/>.
    /// </summary>
    /// <param name="configuration">Application configuration.</param>
    public MinioBlobStorageService(IConfiguration configuration)
    {
        var endpoint = configuration["MinIO:Endpoint"] ?? "localhost:9000";
        var accessKey = configuration["MinIO:AccessKey"] ?? "minioadmin";
        var secretKey = configuration["MinIO:SecretKey"] ?? "minioadmin";
        _bucketName = configuration["MinIO:BucketName"] ?? "fitness-platform";
        _publicEndpoint = configuration["MinIO:PublicEndpoint"] ?? $"http://{endpoint}";

        _client = new MinioClient()
            .WithEndpoint(endpoint)
            .WithCredentials(accessKey, secretKey)
            .Build();
    }

    // Public-read policy for the whole bucket. All assets stored here (avatars,
    // food hero images, recipe images, exercise videos, plan photos) are
    // intended to be fetched directly by the web and mobile clients via the
    // `blobUrl` we hand back. Keeping the bucket private would force every
    // read through a signed GET URL or a backend-proxied endpoint — neither is
    // in scope for the current architecture. See also epic #65 follow-up:
    // if any category of asset needs per-user access control, split it into a
    // separate bucket with a tighter policy.
    private static readonly string PublicReadPolicyTemplate = """
        {
          "Version": "2012-10-17",
          "Statement": [
            {
              "Effect": "Allow",
              "Principal": { "AWS": ["*"] },
              "Action": ["s3:GetObject"],
              "Resource": ["arn:aws:s3:::{BUCKET}/*"]
            }
          ]
        }
        """;

    /// <inheritdoc />
    public async Task<BlobUploadUrl> GenerateUploadUrlAsync(
        string containerPath,
        string contentType,
        TimeSpan expiresIn,
        CancellationToken ct)
    {
        await EnsureBucketWithPublicReadAsync(ct);

        var uploadUrl = await _client.PresignedPutObjectAsync(
            new PresignedPutObjectArgs()
                .WithBucket(_bucketName)
                .WithObject(containerPath)
                .WithExpiry((int)expiresIn.TotalSeconds));

        var blobUrl = $"{_publicEndpoint.TrimEnd('/')}/{_bucketName}/{containerPath}";

        return new BlobUploadUrl(uploadUrl, blobUrl);
    }

    /// <inheritdoc />
    public async Task DeleteAsync(string containerPath, CancellationToken ct)
    {
        await EnsureBucketWithPublicReadAsync(ct);

        // RemoveObjectAsync does not throw if the object is absent — safe to call unconditionally.
        await _client.RemoveObjectAsync(
            new RemoveObjectArgs()
                .WithBucket(_bucketName)
                .WithObject(containerPath),
            ct);
    }

    /// <summary>
    /// Ensures the bucket exists AND has a public-read policy. Idempotent —
    /// safe to call on every upload. Covers the case where the bucket was
    /// created by an earlier version of this service (or by `mc mb` during
    /// manual setup) with the default private policy.
    /// </summary>
    private async Task EnsureBucketWithPublicReadAsync(CancellationToken ct)
    {
        var bucketExists = await _client.BucketExistsAsync(
            new BucketExistsArgs().WithBucket(_bucketName), ct);

        if (!bucketExists)
        {
            await _client.MakeBucketAsync(
                new MakeBucketArgs().WithBucket(_bucketName), ct);
        }

        // Re-apply the policy even on an existing bucket so a formerly-private
        // bucket gets upgraded without manual `mc policy set public` steps.
        var policy = PublicReadPolicyTemplate.Replace("{BUCKET}", _bucketName);
        await _client.SetPolicyAsync(
            new SetPolicyArgs()
                .WithBucket(_bucketName)
                .WithPolicy(policy),
            ct);
    }
}
