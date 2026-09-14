using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Services;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace FitnessPlatform.Tests.Infrastructure.Services;

/// <summary>
/// Unit tests for <see cref="MinioBlobStorageService"/> — the F9 fail-closed signing contract
/// and the URL-normalization helpers it exposes. These are pure unit tests: no Docker / MinIO
/// container is required, because <c>GenerateReadUrlAsync</c>'s presigning and
/// <c>NormalizeToCanonicalUrl</c>'s prefix matching are both local, offline computations — the
/// MinIO SDK's presigned-URL signing never makes a network round trip.
///
/// <para>
/// Before this test class, every double implementing <see cref="FitnessPlatform.Application.Domain.Interfaces.IBlobStorageService"/>
/// in the test suite (<c>FitnessPlatform.Tests.Infrastructure.FakeBlobStorageService</c>, the
/// seed runner's <c>TrackingBlobStorageService</c>) returned a non-empty value from every call,
/// so none of the fail-closed contract added in commit 8b3baebf was ever asserted anywhere
/// against the real implementation.
/// </para>
/// </summary>
public class MinioBlobStorageServiceTests
{
    // ── Helpers ───────────────────────────────────────────────────────────────

    private static MinioBlobStorageService CreateService(
        out ILogger<MinioBlobStorageService> logger,
        bool publicUrlIncludesBucket = true,
        string publicEndpoint = "http://localhost:9000",
        string bucketName = "fitness-platform")
    {
        logger = Substitute.For<ILogger<MinioBlobStorageService>>();

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["MinIO:Endpoint"] = "localhost:9000",
                ["MinIO:AccessKey"] = "minioadmin",
                ["MinIO:SecretKey"] = "minioadmin",
                ["MinIO:Secure"] = "false",
                ["MinIO:Region"] = "us-east-1",
                ["MinIO:BucketName"] = bucketName,
                ["MinIO:ManageBucket"] = "false",
                ["MinIO:PublicUrlIncludesBucket"] = publicUrlIncludesBucket ? "true" : "false",
                ["MinIO:PublicEndpoint"] = publicEndpoint,
                [ConfigKeys.MinIoReadUrlExpiryMinutes] = "15"
            })
            .Build();

        return new MinioBlobStorageService(configuration, logger);
    }

    // ── GenerateReadUrlAsync — fail-closed contract ────────────────────────────

    [Fact]
    public async Task GenerateReadUrlAsync_NullInput_PassesThroughUnchanged()
    {
        var service = CreateService(out _);

        var result = await service.GenerateReadUrlAsync(null, CancellationToken.None);

        result.Should().BeNull();
    }

    [Fact]
    public async Task GenerateReadUrlAsync_EmptyInput_PassesThroughUnchanged()
    {
        var service = CreateService(out _);

        var result = await service.GenerateReadUrlAsync(string.Empty, CancellationToken.None);

        result.Should().Be(string.Empty);
    }

    [Fact]
    public async Task GenerateReadUrlAsync_ForeignPrefix_ReturnsEmptyString_NotStoredValue()
    {
        // Root cause this proves: before commit 8b3baebf, an unparseable stored URL fell back to
        // the raw permanent value via "?? storedBlobUrl", handing the caller an unauthenticated,
        // never-expiring URL — silently undoing F9 for every photo whose row predates a
        // MinIO:PublicEndpoint / BucketName / PublicUrlIncludesBucket change. Revert the
        // fail-closed `return string.Empty;` branch in GenerateReadUrlAsync back to
        // `return storedBlobUrl;` and this assertion fails (result equals the foreign input
        // instead of empty).
        var service = CreateService(out _);
        const string foreignUrl = "https://totally-unrelated-host.example/some/path.jpg";

        var result = await service.GenerateReadUrlAsync(foreignUrl, CancellationToken.None);

        result.Should().Be(string.Empty);
        result.Should().NotBe(foreignUrl);
    }

    [Fact]
    public async Task GenerateReadUrlAsync_ForeignPrefix_LogsWarning()
    {
        // Load-bearing: remove the _logger.LogWarning call from the fail-closed branch and this
        // assertion fails — silent fail-closed extraction is a diagnosability regression, per
        // the review's finding that empty-string-on-failure must remain "visible, diagnosable".
        var service = CreateService(out var logger);
        const string foreignUrl = "https://totally-unrelated-host.example/some/path.jpg";

        await service.GenerateReadUrlAsync(foreignUrl, CancellationToken.None);

        logger.Received(1).Log(
            LogLevel.Warning,
            Arg.Any<EventId>(),
            Arg.Any<object>(),
            Arg.Any<Exception>(),
            Arg.Any<Func<object, Exception?, string>>());
    }

    [Fact]
    public async Task GenerateReadUrlAsync_StrictPrefixMatch_RejectsPartialPrefixCollision()
    {
        // The prefix match is a literal StartsWith on "{publicBase}/{bucket}/" — a URL that
        // merely shares the host but diverges on the bucket segment must NOT be treated as
        // belonging to this service. Revert the prefix computation to a looser match (e.g. host
        // only) and this assertion fails (result would resolve instead of failing closed).
        var service = CreateService(out _, publicUrlIncludesBucket: true, bucketName: "fitness-platform");

        // Correct bucket is "fitness-platform" — this uses a different bucket segment
        // ("other-bucket") under the same host, so the prefix must not match.
        const string wrongBucketUrl = "http://localhost:9000/other-bucket/plan-photos/abc/photo.jpg";

        var result = await service.GenerateReadUrlAsync(wrongBucketUrl, CancellationToken.None);

        result.Should().Be(string.Empty);
    }

    // ── GenerateReadUrlAsync — round trip via BuildPublicUrl (both bucket-URL shapes) ──────────

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task GenerateReadUrlAsync_RoundTripsBuildPublicUrl_ForBothPublicUrlIncludesBucketValues(
        bool publicUrlIncludesBucket)
    {
        // Root cause this proves: TryExtractContainerPath must reverse BuildPublicUrl exactly —
        // it computes its own prefix from _publicEndpoint/_bucketName/_publicUrlIncludesBucket
        // independently of BuildPublicUrl's construction, so the two could silently drift apart
        // in either config branch. Revert either method's prefix logic without keeping them in
        // sync and this test fails for the affected branch: extraction fails, GenerateReadUrlAsync
        // falls back to its fail-closed empty-string branch instead of returning a signed URL.
        //
        // Note: the returned SIGNED url is not asserted to reuse BuildPublicUrl's host/bucket
        // shape — the MinIO client signs against its own S3 endpoint (always path-style,
        // "{endpoint}/{bucket}/{object}"), independent of PublicUrlIncludesBucket, which governs
        // only the PUBLIC-facing shape BuildPublicUrl returns (see the review's MINOR finding on
        // MinIO:Endpoint vs MinIO:PublicEndpoint — a known, disclosed divergence, not a defect
        // this test is about). What this test proves is narrower and load-bearing on its own:
        // extraction from a BuildPublicUrl-produced URL must succeed (not fail closed) in BOTH
        // configuration branches.
        var service = CreateService(out _, publicUrlIncludesBucket: publicUrlIncludesBucket);

        const string containerPath = "plan-photos/plan-abc/photo.jpg";
        var storedBlobUrl = service.BuildPublicUrl(containerPath);

        var result = await service.GenerateReadUrlAsync(storedBlobUrl, CancellationToken.None);

        result.Should().NotBeNullOrEmpty(
            "extraction of a BuildPublicUrl-produced URL must succeed, not fail closed, in this PublicUrlIncludesBucket branch");
        result.Should().NotBe(storedBlobUrl, "a signed URL must differ from the stored canonical value");
        result!.Should().Contain(containerPath, "the signed URL must still resolve to the same underlying object");
    }

    // ── NormalizeToCanonicalUrl ─────────────────────────────────────────────────

    [Fact]
    public void NormalizeToCanonicalUrl_NullOrEmpty_ReturnsNull()
    {
        var service = CreateService(out _);

        service.NormalizeToCanonicalUrl(string.Empty).Should().BeNull();
    }

    [Fact]
    public void NormalizeToCanonicalUrl_ForeignValue_ReturnsNull()
    {
        var service = CreateService(out _);

        service.NormalizeToCanonicalUrl("https://totally-unrelated-host.example/x.jpg")
            .Should().BeNull();
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void NormalizeToCanonicalUrl_StripsSignedQueryString_BackToCanonicalForm(
        bool publicUrlIncludesBucket)
    {
        // Load-bearing for the write-path defence-in-depth fix: a client that echoes back a
        // signed read URL (query string intact) must normalize to EXACTLY the same value
        // BuildPublicUrl produces — not a value that still carries the signature. Revert
        // NormalizeToCanonicalUrl to skip the query-string strip and this assertion fails (the
        // "normalized" value would still contain "?X-Amz-Signature=...").
        var service = CreateService(out _, publicUrlIncludesBucket: publicUrlIncludesBucket);

        const string containerPath = "plan-photos/plan-abc/photo.jpg";
        var canonical = service.BuildPublicUrl(containerPath);
        var signedEcho = $"{canonical}?X-Amz-Signature=deadbeef&X-Amz-Expires=900";

        var normalized = service.NormalizeToCanonicalUrl(signedEcho);

        normalized.Should().Be(canonical);
        normalized.Should().NotContain("?");
    }

    [Fact]
    public void NormalizeToCanonicalUrl_RelativeContainerPath_NormalizesToCanonicalUrl()
    {
        // A client may submit the bare container path (no scheme) rather than the full public
        // URL — both write-path validators historically accepted this shape. It must still
        // normalize to the canonical, full form so it round-trips through GenerateReadUrlAsync.
        var service = CreateService(out _);

        const string containerPath = "plan-photos/plan-abc/photo.jpg";
        var expected = service.BuildPublicUrl(containerPath);

        var normalized = service.NormalizeToCanonicalUrl(containerPath);

        normalized.Should().Be(expected);
    }

    // ── ReadUrlExpiryMinutes default ────────────────────────────────────────────

    [Fact]
    public async Task GenerateReadUrlAsync_NoExpiryConfigured_DefaultsTo15Minutes()
    {
        // Load-bearing: build a service with NO MinIO:ReadUrlExpiryMinutes key at all (as
        // render.yaml / docker-compose.test.yml currently do — the review flagged this key as
        // absent from both) and confirm the presigned URL still carries a 900-second
        // (15-minute) expiry window rather than throwing or defaulting to something else.
        // Revert the "15" default literal in the constructor and this assertion fails.
        var logger = Substitute.For<ILogger<MinioBlobStorageService>>();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["MinIO:Endpoint"] = "localhost:9000",
                ["MinIO:AccessKey"] = "minioadmin",
                ["MinIO:SecretKey"] = "minioadmin",
                ["MinIO:Secure"] = "false",
                ["MinIO:Region"] = "us-east-1",
                ["MinIO:BucketName"] = "fitness-platform",
                ["MinIO:ManageBucket"] = "false",
                ["MinIO:PublicUrlIncludesBucket"] = "true",
                ["MinIO:PublicEndpoint"] = "http://localhost:9000"
                // MinIO:ReadUrlExpiryMinutes intentionally absent.
            })
            .Build();
        var service = new MinioBlobStorageService(configuration, logger);

        const string containerPath = "plan-photos/plan-abc/photo.jpg";
        var storedBlobUrl = service.BuildPublicUrl(containerPath);

        var result = await service.GenerateReadUrlAsync(storedBlobUrl, CancellationToken.None);

        result.Should().NotBeNullOrEmpty();
        result.Should().Contain("Expires=900", "15 minutes == 900 seconds, the MinIO SDK's presigned-URL expiry query parameter");
    }
}
