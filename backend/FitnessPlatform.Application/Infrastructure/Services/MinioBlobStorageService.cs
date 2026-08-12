using FitnessPlatform.Application.Domain.Constants;
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
    private readonly TimeSpan _readUrlExpiry;
    private readonly ILogger<MinioBlobStorageService> _logger;

    public MinioBlobStorageService(
        IConfiguration configuration,
        ILogger<MinioBlobStorageService> logger)
    {
        _logger = logger;

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
        _readUrlExpiry = TimeSpan.FromMinutes(
            configuration.GetValue(ConfigKeys.MinIoReadUrlExpiryMinutes, 15));

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
    //
    // Scoped to catalog/profile prefixes only (avatars, foods, recipes, exercise videos) —
    // content that is meant to be publicly viewable regardless of session or relationship.
    // Deliberately EXCLUDES "plan-photos/*" and "diary/*" (client progress, meal, and session
    // photos): those objects must only resolve via a pre-signed GET minted by
    // GenerateReadUrlAsync, so that revoking a client-professional link stops an already-issued
    // URL from resolving once its short signature window elapses (F9 — a bucket-wide grant would
    // make every stored blob URL permanent and unauthenticated regardless of link state).
    private static readonly string PublicReadPolicyTemplate = """
        {
          "Version": "2012-10-17",
          "Statement": [
            {
              "Effect": "Allow",
              "Principal": { "AWS": ["*"] },
              "Action": ["s3:GetObject"],
              "Resource": [
                "arn:aws:s3:::{BUCKET}/avatars/*",
                "arn:aws:s3:::{BUCKET}/foods/*",
                "arn:aws:s3:::{BUCKET}/recipes/*",
                "arn:aws:s3:::{BUCKET}/exercises/*"
              ]
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

        return new BlobUploadUrl(uploadUrl, BuildPublicUrl(containerPath));
    }

    /// <inheritdoc />
    public string BuildPublicUrl(string containerPath)
    {
        var publicBase = _publicEndpoint.TrimEnd('/');
        return _publicUrlIncludesBucket
            ? $"{publicBase}/{_bucketName}/{containerPath}"
            : $"{publicBase}/{containerPath}";
    }

    /// <inheritdoc />
    public async Task<string?> GenerateReadUrlAsync(string? storedBlobUrl, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(storedBlobUrl))
        {
            return storedBlobUrl;
        }

        var containerPath = TryExtractContainerPath(storedBlobUrl);
        if (containerPath is null)
        {
            // Fail CLOSED, and loudly. Extraction reverses BuildPublicUrl using the CURRENT
            // MinIO:PublicEndpoint / BucketName / PublicUrlIncludesBucket configuration, so every
            // row written before a change to any of those stops matching — not a rare foreign-value
            // case but a whole-table one. Returning the stored value unchanged there would hand the
            // caller the permanent unsigned URL this method exists to replace, silently undoing F9
            // for every photo. That is worse in production than in dev: MinIO:ManageBucket is false
            // on the hosted bucket, so the narrowed public-read policy below is not applied there
            // and the raw URL genuinely resolves.
            //
            // An empty value renders as a broken image — visible, diagnosable, and safe. Still not
            // an exception, so one unparseable row cannot fail an entire photo-list response.
            _logger.LogWarning(
                "Could not derive a container path from stored blob URL, so no signed read URL was "
                + "issued and the photo will not render. This usually means MinIO:PublicEndpoint, "
                + "MinIO:BucketName or MinIO:PublicUrlIncludesBucket changed after the row was "
                + "written. Stored prefix seen: {StoredPrefix}",
                storedBlobUrl.Length > 40 ? storedBlobUrl[..40] : storedBlobUrl);

            return string.Empty;
        }

        // No bucket-existence check here (unlike the write paths above): an object can only be
        // read if it was already uploaded, which already ensured the bucket exists. Presigning
        // a GET is a local signature computation — it needs no network round trip.
        return await _client.PresignedGetObjectAsync(
            new PresignedGetObjectArgs()
                .WithBucket(_bucketName)
                .WithObject(containerPath)
                .WithExpiry((int)_readUrlExpiry.TotalSeconds));
    }

    /// <inheritdoc />
    public string? NormalizeToCanonicalUrl(string blobUrl)
    {
        if (string.IsNullOrWhiteSpace(blobUrl))
        {
            return null;
        }

        // Strip a pre-signed query string (e.g. "?X-Amz-Signature=...") before matching — an
        // echoed short-lived read URL must resolve to the same canonical value as its unsigned
        // form, or a legitimate re-save turns into a delete-and-reinsert under REPLACE semantics.
        var withoutQuery = blobUrl.Split('?', 2)[0];

        var containerPath = withoutQuery.Contains("://", StringComparison.Ordinal)
            ? TryExtractContainerPath(withoutQuery)
            : withoutQuery;

        return containerPath is null ? null : BuildPublicUrl(containerPath);
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

    /// <summary>
    /// Reverses <see cref="BuildPublicUrl"/>: strips the configured public-base (and bucket
    /// segment, when <see cref="_publicUrlIncludesBucket"/>) prefix from a stored blob URL to
    /// recover the raw container path. Returns null when <paramref name="blobUrl"/> does not
    /// start with the expected prefix — a foreign URL or a value from before a config change.
    /// </summary>
    private string? TryExtractContainerPath(string blobUrl)
    {
        var publicBase = _publicEndpoint.TrimEnd('/');
        var prefix = _publicUrlIncludesBucket
            ? $"{publicBase}/{_bucketName}/"
            : $"{publicBase}/";

        return blobUrl.StartsWith(prefix, StringComparison.Ordinal)
            ? blobUrl[prefix.Length..]
            : null;
    }
}
