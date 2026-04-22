using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
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

    // ── Happy path ──────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_AuthenticatedUser_WithJpeg_ReturnsUploadUrlAndBlobUrl()
    {
        var blobUrl = $"avatars/{_userId}.jpg";
        _imageUpload
            .GenerateUploadUrlAsync(
                ImageUploadScope.Avatar,
                $"{_userId}.jpg",
                "image/jpeg",
                1024,
                Arg.Any<CancellationToken>())
            .Returns(new BlobUploadUrl("https://storage/upload?token=abc", blobUrl));

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
        ep.Response.BlobUrl.Should().StartWith("avatars/");
        ep.Response.BlobUrl.Should().Be(blobUrl);
    }

    [Theory]
    [InlineData("image/jpeg", "jpg")]
    [InlineData("image/png", "png")]
    [InlineData("image/webp", "webp")]
    public async Task HandleAsync_AllowedContentTypes_CallServiceWithCorrectSubPath(
        string contentType, string expectedExt)
    {
        var expectedSubPath = $"{_userId}.{expectedExt}";
        _imageUpload
            .GenerateUploadUrlAsync(
                ImageUploadScope.Avatar,
                expectedSubPath,
                contentType,
                512,
                Arg.Any<CancellationToken>())
            .Returns(new BlobUploadUrl(
                "https://storage/upload",
                $"avatars/{expectedSubPath}"));

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
            expectedSubPath,
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
        epA.Response.BlobUrl.Should().Contain(userAId.ToString());
        epB.Response.BlobUrl.Should().Contain(userBId.ToString());
        epA.Response.BlobUrl.Should().NotContain(userBId.ToString());
        epB.Response.BlobUrl.Should().NotContain(userAId.ToString());
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
