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
    [InlineData("image/png")]
    [InlineData("image/webp")]
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
    [InlineData("image/gif")]
    [InlineData("image/bmp")]
    [InlineData("image/svg+xml")]
    [InlineData("video/mp4")]
    [InlineData("text/plain")]
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
    public async Task GenerateUploadUrlAsync_ExactlyAtLimit_ReturnsUploadUrl()
    {
        var result = await _sut.GenerateUploadUrlAsync(
            ImageUploadScope.Food,
            "food456.jpg",
            "image/jpeg",
            ImageUploadService.MaxImageSizeBytes, // exactly at the limit — allowed
            CancellationToken.None);

        result.Should().NotBeNull();
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
    [InlineData("foo/../../bar.jpg")]
    [InlineData("/absolute.jpg")]
    [InlineData("foo\\bar.jpg")]
    [InlineData("")]
    [InlineData("   ")]
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
}
