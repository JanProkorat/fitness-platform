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

    /// <inheritdoc />
    public async Task<BlobUploadUrl> GenerateUploadUrlAsync(
        string containerPath,
        string contentType,
        TimeSpan expiresIn,
        CancellationToken ct)
    {
        // Ensure bucket exists
        var bucketExists = await _client.BucketExistsAsync(
            new BucketExistsArgs().WithBucket(_bucketName), ct);

        if (!bucketExists)
        {
            await _client.MakeBucketAsync(
                new MakeBucketArgs().WithBucket(_bucketName), ct);
        }

        var uploadUrl = await _client.PresignedPutObjectAsync(
            new PresignedPutObjectArgs()
                .WithBucket(_bucketName)
                .WithObject(containerPath)
                .WithExpiry((int)expiresIn.TotalSeconds));

        var blobUrl = $"{_publicEndpoint.TrimEnd('/')}/{_bucketName}/{containerPath}";

        return new BlobUploadUrl(uploadUrl, blobUrl);
    }
}
