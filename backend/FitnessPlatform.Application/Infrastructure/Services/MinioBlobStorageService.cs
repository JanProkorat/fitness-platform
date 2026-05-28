using FitnessPlatform.Application.Domain.Interfaces;
using Minio;
using Minio.DataModel.Args;

namespace FitnessPlatform.Application.Infrastructure.Services;

/// <summary>
/// S3-compatible blob storage. Talks to local MinIO by default; can be pointed
/// at Cloudflare R2 (or any S3-compatible service) via the MinIO config block:
///   - Secure                  : true  → HTTPS (required for R2)
///   - Region                  : "auto" for R2; "us-east-1" for AWS
///   - ManageBucket            : false → skip bucket create + public-read policy
///                               (R2 rejects PutBucketPolicy; configure public
///                               access from the Cloudflare dashboard instead)
///   - PublicUrlIncludesBucket : false → public read URL is `{publicEndpoint}/{key}`
///                               (R2 `pub-*.r2.dev` URLs already map to one bucket)
/// </summary>
public class MinioBlobStorageService : IBlobStorageService
{
    private readonly IMinioClient _client;
    private readonly string _bucketName;
    private readonly string _publicEndpoint;
    private readonly bool _manageBucket;
    private readonly bool _publicUrlIncludesBucket;

    public MinioBlobStorageService(IConfiguration configuration)
    {
        var endpoint = configuration["MinIO:Endpoint"] ?? "localhost:9000";
        var accessKey = configuration["MinIO:AccessKey"] ?? "minioadmin";
        var secretKey = configuration["MinIO:SecretKey"] ?? "minioadmin";
        var secure = configuration.GetValue("MinIO:Secure", false);
        var region = configuration["MinIO:Region"];
        _bucketName = configuration["MinIO:BucketName"] ?? "fitness-platform";
        _manageBucket = configuration.GetValue("MinIO:ManageBucket", true);
        _publicUrlIncludesBucket = configuration.GetValue("MinIO:PublicUrlIncludesBucket", true);
        _publicEndpoint = configuration["MinIO:PublicEndpoint"]
                          ?? $"{(secure ? "https" : "http")}://{endpoint}";

        var builder = new MinioClient()
            .WithEndpoint(endpoint)
            .WithCredentials(accessKey, secretKey);

        if (secure)
        {
            builder = builder.WithSSL();
        }

        if (!string.IsNullOrWhiteSpace(region))
        {
            builder = builder.WithRegion(region);
        }

        _client = builder.Build();
    }

    // Public-read policy applied when ManageBucket=true (local MinIO). For R2,
    // public access is toggled in the Cloudflare dashboard ("Allow R2.dev
    // access" or via a custom domain) — this code path is skipped entirely.
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

        var publicBase = _publicEndpoint.TrimEnd('/');
        var blobUrl = _publicUrlIncludesBucket
            ? $"{publicBase}/{_bucketName}/{containerPath}"
            : $"{publicBase}/{containerPath}";

        return new BlobUploadUrl(uploadUrl, blobUrl);
    }

    /// <inheritdoc />
    public async Task UploadAsync(string containerPath, byte[] data, string contentType, CancellationToken ct)
    {
        await EnsureBucketWithPublicReadAsync(ct);

        using var ms = new MemoryStream(data);
        await _client.PutObjectAsync(
            new PutObjectArgs()
                .WithBucket(_bucketName)
                .WithObject(containerPath)
                .WithStreamData(ms)
                .WithObjectSize(data.Length)
                .WithContentType(contentType),
            ct);
    }

    /// <inheritdoc />
    public async Task<bool> ObjectExistsAsync(string containerPath, CancellationToken ct)
    {
        await EnsureBucketWithPublicReadAsync(ct);

        try
        {
            await _client.StatObjectAsync(
                new StatObjectArgs()
                    .WithBucket(_bucketName)
                    .WithObject(containerPath),
                ct);
            return true;
        }
        catch (Minio.Exceptions.ObjectNotFoundException)
        {
            return false;
        }
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
    /// For local MinIO (ManageBucket=true): ensures the bucket exists AND has
    /// a public-read policy. Idempotent — safe to call on every upload.
    /// For R2/S3 (ManageBucket=false): no-op. The bucket and its access policy
    /// must be configured out-of-band.
    /// </summary>
    private async Task EnsureBucketWithPublicReadAsync(CancellationToken ct)
    {
        if (!_manageBucket)
        {
            return;
        }

        var bucketExists = await _client.BucketExistsAsync(
            new BucketExistsArgs().WithBucket(_bucketName), ct);

        if (!bucketExists)
        {
            await _client.MakeBucketAsync(
                new MakeBucketArgs().WithBucket(_bucketName), ct);
        }

        var policy = PublicReadPolicyTemplate.Replace("{BUCKET}", _bucketName);
        await _client.SetPolicyAsync(
            new SetPolicyArgs()
                .WithBucket(_bucketName)
                .WithPolicy(policy),
            ct);
    }
}
