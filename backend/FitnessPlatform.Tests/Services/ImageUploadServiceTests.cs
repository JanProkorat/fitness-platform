using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Services;
using NSubstitute;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Unit tests for <see cref="ImageUploadService"/>.
/// </summary>
public class ImageUploadServiceTests
{
    private readonly IBlobStorageService _blobStorage = Substitute.For<IBlobStorageService>();
    private readonly ImageUploadService _sut;

    public ImageUploadServiceTests()
    {
        _blobStorage
            .GenerateUploadUrlAsync(
                Arg.Any<string>(),
                Arg.Any<string>(),
                Arg.Any<TimeSpan>(),
                Arg.Any<CancellationToken>())
            .Returns(new BlobUploadUrl("https://minio/upload?token=abc", "https://minio/bucket/avatars/user.jpg"));

        _sut = new ImageUploadService(_blobStorage);
    }

    // ── Content-type whitelist ──────────────────────────────────────────────

    [Theory]
    [InlineData("image/jpeg")]
    [InlineData("IMAGE/JPEG")] // case-insensitive
    public async Task GenerateUploadUrlAsync_AllowedContentType_ReturnsUploadUrl(string contentType)
    {
        var result = await _sut.GenerateUploadUrlAsync(
            ImageUploadScope.Avatar,
            "user123.jpg",
            contentType,
            1024,
            CancellationToken.None);

        result.Should().NotBeNull();
        result.UploadUrl.Should().NotBeNullOrEmpty();
    }

    [Theory]
    [InlineData("application/pdf")]
    [InlineData("")]
    public async Task GenerateUploadUrlAsync_InvalidContentType_ThrowsWithErrorCode(string contentType)
    {
        var act = () => _sut.GenerateUploadUrlAsync(
            ImageUploadScope.Avatar,
            "user123.jpg",
            contentType,
            1024,
            CancellationToken.None);

        var ex = await act.Should().ThrowAsync<ValidationFailureException>();
        ex.Which.Failures
            .Should().ContainSingle(f => f.ErrorCode == ErrorCodes.InvalidImageContentType);
    }

    // ── Size cap ────────────────────────────────────────────────────────────

    [Fact]
    public async Task GenerateUploadUrlAsync_ExactlyAtLimit_DoesNotThrow()
    {
        var act = () => _sut.GenerateUploadUrlAsync(
            ImageUploadScope.Food,
            "food456.jpg",
            "image/jpeg",
            ImageUploadService.MaxImageSizeBytes, // exactly at the limit — allowed
            CancellationToken.None);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task GenerateUploadUrlAsync_OneBytePastLimit_ThrowsWithErrorCode()
    {
        var act = () => _sut.GenerateUploadUrlAsync(
            ImageUploadScope.Food,
            "food456.jpg",
            "image/jpeg",
            ImageUploadService.MaxImageSizeBytes + 1,
            CancellationToken.None);

        var ex = await act.Should().ThrowAsync<ValidationFailureException>();
        ex.Which.Failures
            .Should().ContainSingle(f => f.ErrorCode == ErrorCodes.ImageTooLarge);
    }

    [Fact]
    public async Task GenerateUploadUrlAsync_SixMegabytes_ThrowsWithErrorCode()
    {
        const long sixMb = 6L * 1024 * 1024;

        var act = () => _sut.GenerateUploadUrlAsync(
            ImageUploadScope.Diary,
            "diary789/photo1.jpg",
            "image/jpeg",
            sixMb,
            CancellationToken.None);

        var ex = await act.Should().ThrowAsync<ValidationFailureException>();
        ex.Which.Failures
            .Should().ContainSingle(f => f.ErrorCode == ErrorCodes.ImageTooLarge);
    }

    // ── Blob-path conventions ───────────────────────────────────────────────

    [Theory]
    [InlineData(ImageUploadScope.Avatar,    "user-id.jpg",               "avatars/user-id.jpg")]
    [InlineData(ImageUploadScope.Food,      "food-id.png",               "foods/food-id.png")]
    [InlineData(ImageUploadScope.Recipe,    "recipe-id/cover.jpg",       "recipes/recipe-id/cover.jpg")]
    [InlineData(ImageUploadScope.PlanPhoto, "plan-id/photo-id.webp",     "plan-photos/plan-id/photo-id.webp")]
    [InlineData(ImageUploadScope.Diary,     "diary-id/photo-id.jpg",     "diary/diary-id/photo-id.jpg")]
    public async Task GenerateUploadUrlAsync_CorrectScope_UsesExpectedBlobPath(
        ImageUploadScope scope,
        string subPath,
        string expectedContainerPath)
    {
        await _sut.GenerateUploadUrlAsync(scope, subPath, "image/jpeg", 1024, CancellationToken.None);

        await _blobStorage.Received(1).GenerateUploadUrlAsync(
            expectedContainerPath,
            "image/jpeg",
            Arg.Any<TimeSpan>(),
            Arg.Any<CancellationToken>());
    }

    // ── Sub-path escape prevention ──────────────────────────────────────────

    [Theory]
    [InlineData("../foo.jpg")]
    [InlineData("/absolute.jpg")]
    [InlineData("foo\\bar.jpg")]
    [InlineData("")]
    public async Task GenerateUploadUrlAsync_SubPathTriesToEscape_ThrowsWithErrorCode(string subPath)
    {
        var act = () => _sut.GenerateUploadUrlAsync(
            ImageUploadScope.Avatar,
            subPath,
            "image/jpeg",
            1024,
            CancellationToken.None);

        var ex = await act.Should().ThrowAsync<ValidationFailureException>();
        ex.Which.Failures
            .Should().ContainSingle(f => f.ErrorCode == ErrorCodes.InvalidImageSubPath);
    }

    // ── Validation priority: content-type checked before size ───────────────

    [Fact]
    public async Task GenerateUploadUrlAsync_InvalidContentTypeAndOversize_ThrowsContentTypeError()
    {
        // When both are wrong, the content-type check fires first
        var act = () => _sut.GenerateUploadUrlAsync(
            ImageUploadScope.Avatar,
            "file.pdf",
            "application/pdf",
            ImageUploadService.MaxImageSizeBytes + 1,
            CancellationToken.None);

        var ex = await act.Should().ThrowAsync<ValidationFailureException>();
        ex.Which.Failures
            .Should().ContainSingle(f => f.ErrorCode == ErrorCodes.InvalidImageContentType);
    }

    // ── IsValidBlobUrlUnderSubPath ──────────────────────────────────────────

    private const string BucketRoot = "https://minio/bucket/";

    [Theory]
    [InlineData("https://minio/bucket/diary/meal1/a.jpg", true)]
    [InlineData("https://minio/bucket/diary/meal1/0f8fad5b.png", true)]
    [InlineData("https://minio/bucket/diary/meal1/x.webp", true)]
    [InlineData("https://minio/bucket/diary/meal1/x.heic", true)]
    [InlineData("https://minio/bucket/diary/meal1/x.heif", true)]
    [InlineData("https://minio/bucket/diary/meal1/a.JPG", false)]            // case-sensitive extension
    [InlineData("https://minio/bucket/diary/meal1/a.gif", false)]            // disallowed extension
    [InlineData("https://minio/bucket/diary/meal1/.jpg", false)]             // only an extension
    [InlineData("https://minio/bucket/diary/meal1/", false)]                 // empty name
    [InlineData("https://minio/bucket/diary/meal1/sub/a.jpg", false)]        // nested
    [InlineData("https://minio/bucket/diary/meal1/..a.jpg", false)]          // dot-dot
    [InlineData("https://minio/bucket/diary/meal1/a\\b.jpg", false)]         // backslash
    [InlineData("https://minio/bucket/diary/meal1/a%2Fb.jpg", false)]        // percent
    [InlineData("https://minio/bucket/diary/meal1/a.jpg?sig=1", false)]      // query
    [InlineData("https://minio/bucket/diary/meal1/a.jpg#frag", false)]       // fragment
    [InlineData("https://minio/bucket/diary/meal10/a.jpg", false)]           // sibling folder sharing the prefix
    [InlineData("https://minio/bucket/diary/meal2/a.jpg", false)]            // other folder
    [InlineData("https://minio/bucket/plan-photos/meal1/a.jpg", false)]      // other scope
    [InlineData("https://evil.example.com/diary/meal1/a.jpg", false)]        // foreign host
    [InlineData("", false)]
    public void IsValidBlobUrlUnderSubPath_Url_MatchesExpectation(string blobUrl, bool expected)
    {
        _blobStorage.BuildPublicUrl(Arg.Any<string>()).Returns(call => BucketRoot + call.Arg<string>());

        _sut.IsValidBlobUrlUnderSubPath(ImageUploadScope.Diary, "meal1", blobUrl)
            .Should().Be(expected);
    }

    [Fact]
    public void IsValidBlobUrlUnderSubPath_BlankSubPath_ReturnsFalse()
    {
        _blobStorage.BuildPublicUrl(Arg.Any<string>()).Returns(call => BucketRoot + call.Arg<string>());

        _sut.IsValidBlobUrlUnderSubPath(ImageUploadScope.Diary, " ", "https://minio/bucket/diary//a.jpg")
            .Should().BeFalse();
    }
}
