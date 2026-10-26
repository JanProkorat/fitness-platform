using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.Users.Avatar;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace FitnessPlatform.Tests.Endpoints.Users.Avatar;

/// <summary>
/// Unit tests for <see cref="GenerateAvatarUploadUrlEndpoint"/>.
/// </summary>
public class GenerateAvatarUploadUrlEndpointTests
{
    private readonly Guid _userId = Guid.NewGuid();
    private readonly IImageUploadService _imageUpload = Substitute.For<IImageUploadService>();

    private bool IsOwnUniqueSubPath(string subPath, string extension) =>
        AvatarBlobKeys.TryParseUserKey(subPath, _userId, out _) && subPath.EndsWith("." + extension);

    // ── Happy path ──────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_AuthenticatedUser_WithJpeg_ReturnsUploadUrlAndUniqueBlobUrl()
    {
        _imageUpload
            .GenerateUploadUrlAsync(
                ImageUploadScope.Avatar,
                Arg.Any<string>(),
                "image/jpeg",
                1024,
                Arg.Any<CancellationToken>())
            .Returns(ci => new BlobUploadUrl("https://storage/upload?token=abc", $"avatars/{ci.ArgAt<string>(1)}"));

        var ep = Factory.Create<GenerateAvatarUploadUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            _imageUpload);

        await ep.HandleAsync(new GenerateAvatarUploadUrlRequest
        {
            ContentType = "image/jpeg",
            SizeBytes = 1024
        }, CancellationToken.None);

        ep.Response.UploadUrl.Should().Be("https://storage/upload?token=abc");
        AvatarBlobKeys.TryParseUserKey(ep.Response.BlobUrl, _userId, out _).Should().BeTrue();
    }

    [Theory]
    [InlineData("image/jpeg", "jpg")]
    [InlineData("image/png", "png")]
    [InlineData("image/webp", "webp")]
    public async Task HandleAsync_AllowedContentTypes_CallServiceWithUniqueSubPathAndExtension(
        string contentType, string expectedExt)
    {
        _imageUpload
            .GenerateUploadUrlAsync(
                Arg.Any<ImageUploadScope>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<long>(), Arg.Any<CancellationToken>())
            .Returns(ci => new BlobUploadUrl("https://storage/upload", $"avatars/{ci.ArgAt<string>(1)}"));

        var ep = Factory.Create<GenerateAvatarUploadUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            _imageUpload);

        await ep.HandleAsync(new GenerateAvatarUploadUrlRequest
        {
            ContentType = contentType,
            SizeBytes = 512
        }, CancellationToken.None);

        await _imageUpload.Received(1).GenerateUploadUrlAsync(
            ImageUploadScope.Avatar,
            Arg.Is<string>(subPath => IsOwnUniqueSubPath(subPath, expectedExt)),
            contentType,
            512,
            Arg.Any<CancellationToken>());
    }

    // ── Ownership: route is /users/me so caller only ever sets their own ─────

    [Fact]
    public async Task HandleAsync_TwoDistinctUsers_EachGetSubPathWithOwnId()
    {
        var userAId = Guid.NewGuid();
        var userBId = Guid.NewGuid();

        _imageUpload
            .GenerateUploadUrlAsync(
                Arg.Any<ImageUploadScope>(),
                Arg.Any<string>(),
                Arg.Any<string>(),
                Arg.Any<long>(),
                Arg.Any<CancellationToken>())
            .Returns(ci => new BlobUploadUrl(
                "https://storage/upload",
                $"avatars/{ci.ArgAt<string>(1)}"));

        // User A
        var epA = Factory.Create<GenerateAvatarUploadUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(userAId))),
            _imageUpload);

        await epA.HandleAsync(new GenerateAvatarUploadUrlRequest
        {
            ContentType = "image/jpeg",
            SizeBytes = 100
        }, CancellationToken.None);

        // User B
        var epB = Factory.Create<GenerateAvatarUploadUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(userBId))),
            _imageUpload);

        await epB.HandleAsync(new GenerateAvatarUploadUrlRequest
        {
            ContentType = "image/jpeg",
            SizeBytes = 100
        }, CancellationToken.None);

        // Each endpoint used the caller's own userId as subPath
        AvatarBlobKeys.TryParseUserKey(epA.Response.BlobUrl, userAId, out _).Should().BeTrue();
        AvatarBlobKeys.TryParseUserKey(epB.Response.BlobUrl, userBId, out _).Should().BeTrue();
        AvatarBlobKeys.TryParseUserKey(epA.Response.BlobUrl, userBId, out _).Should().BeFalse();
        AvatarBlobKeys.TryParseUserKey(epB.Response.BlobUrl, userAId, out _).Should().BeFalse();
        epA.Response.BlobUrl.Should().NotBe(epB.Response.BlobUrl);
    }

    // ── Unauthenticated ─────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var ep = Factory.Create<GenerateAvatarUploadUrlEndpoint>(_imageUpload);

        await ep.HandleAsync(new GenerateAvatarUploadUrlRequest
        {
            ContentType = "image/jpeg",
            SizeBytes = 1024
        }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
        await _imageUpload.DidNotReceive().GenerateUploadUrlAsync(
            Arg.Any<ImageUploadScope>(),
            Arg.Any<string>(),
            Arg.Any<string>(),
            Arg.Any<long>(),
            Arg.Any<CancellationToken>());
    }

    // ── Service-level rejections surfaced to caller ─────────────────────────

    [Fact]
    public async Task HandleAsync_InvalidContentType_ServiceThrows_PropagatesException()
    {
        _imageUpload
            .GenerateUploadUrlAsync(
                Arg.Any<ImageUploadScope>(),
                Arg.Any<string>(),
                "application/pdf",
                Arg.Any<long>(),
                Arg.Any<CancellationToken>())
            .Throws(new ValidationFailureException(
                [new FluentValidation.Results.ValidationFailure("contentType", "invalid")
                    { ErrorCode = ErrorCodes.InvalidImageContentType }],
                "Invalid content type."));

        var ep = Factory.Create<GenerateAvatarUploadUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            _imageUpload);

        var act = () => ep.HandleAsync(new GenerateAvatarUploadUrlRequest
        {
            ContentType = "application/pdf",
            SizeBytes = 1024
        }, CancellationToken.None);

        var ex = await act.Should().ThrowAsync<ValidationFailureException>();
        ex.Which.Failures.Should()
            .ContainSingle(f => f.ErrorCode == ErrorCodes.InvalidImageContentType);
    }

    [Fact]
    public async Task HandleAsync_Oversize_ServiceThrows_PropagatesException()
    {
        const long sixMb = 6L * 1024 * 1024;

        _imageUpload
            .GenerateUploadUrlAsync(
                Arg.Any<ImageUploadScope>(),
                Arg.Any<string>(),
                "image/jpeg",
                sixMb,
                Arg.Any<CancellationToken>())
            .Throws(new ValidationFailureException(
                [new FluentValidation.Results.ValidationFailure("sizeBytes", "too large")
                    { ErrorCode = ErrorCodes.ImageTooLarge }],
                "Image too large."));

        var ep = Factory.Create<GenerateAvatarUploadUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            _imageUpload);

        var act = () => ep.HandleAsync(new GenerateAvatarUploadUrlRequest
        {
            ContentType = "image/jpeg",
            SizeBytes = sixMb
        }, CancellationToken.None);

        var ex = await act.Should().ThrowAsync<ValidationFailureException>();
        ex.Which.Failures.Should()
            .ContainSingle(f => f.ErrorCode == ErrorCodes.ImageTooLarge);
    }
}
