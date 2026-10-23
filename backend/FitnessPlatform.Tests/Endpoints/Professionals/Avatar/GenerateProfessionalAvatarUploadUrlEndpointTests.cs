using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.Professionals.Avatar;
using FitnessPlatform.Tests.Builders;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace FitnessPlatform.Tests.Endpoints.Professionals.Avatar;

/// <summary>
/// Unit tests for <see cref="GenerateProfessionalAvatarUploadUrlEndpoint"/>.
/// </summary>
public class GenerateProfessionalAvatarUploadUrlEndpointTests
{
    private readonly Guid _userId = Guid.NewGuid();
    private readonly long _profileId = 42L;
    private readonly IImageUploadService _imageUpload = Substitute.For<IImageUploadService>();

    private GenerateProfessionalAvatarUploadUrlEndpoint CreateEndpoint(
        Guid userId,
        long profileId,
        IImageUploadService? imageUpload = null)
    {
        var profile = new ProfessionalProfile { Id = profileId, UserId = userId };
        var db = new MockDbBuilder().With(profile).Build();

        return Factory.Create<GenerateProfessionalAvatarUploadUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(userId, AppRoles.Trainer))),
            imageUpload ?? _imageUpload,
            db);
    }

    private bool IsOwnUniqueSubPath(string subPath, string extension) =>
        AvatarBlobKeys.TryParseProfessionalKey(subPath, _profileId, out _) && subPath.EndsWith("." + extension);

    // ── Happy path ──────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_AuthenticatedProfessional_WithJpeg_ReturnsUploadUrlAndUniqueBlobUrl()
    {
        _imageUpload
            .GenerateUploadUrlAsync(
                ImageUploadScope.Avatar,
                Arg.Any<string>(),
                "image/jpeg",
                1024,
                Arg.Any<CancellationToken>())
            .Returns(ci => new BlobUploadUrl("https://storage/upload?token=abc", $"avatars/{ci.ArgAt<string>(1)}"));

        var ep = CreateEndpoint(_userId, _profileId);

        await ep.HandleAsync(new GenerateProfessionalAvatarUploadUrlRequest
        {
            ContentType = "image/jpeg",
            SizeBytes = 1024
        }, CancellationToken.None);

        ep.Response.UploadUrl.Should().Be("https://storage/upload?token=abc");
        AvatarBlobKeys.TryParseProfessionalKey(ep.Response.BlobUrl, _profileId, out _).Should().BeTrue();
    }

    [Theory]
    [InlineData("image/jpeg", "jpg")]
    [InlineData("image/png", "png")]
    [InlineData("image/webp", "webp")]
    public async Task HandleAsync_AllowedContentTypes_CallsServiceWithUniqueSubPathAndExtension(
        string contentType, string expectedExt)
    {
        _imageUpload
            .GenerateUploadUrlAsync(
                Arg.Any<ImageUploadScope>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<long>(), Arg.Any<CancellationToken>())
            .Returns(ci => new BlobUploadUrl("https://storage/upload", $"avatars/{ci.ArgAt<string>(1)}"));

        var ep = CreateEndpoint(_userId, _profileId);

        await ep.HandleAsync(new GenerateProfessionalAvatarUploadUrlRequest
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

    [Fact]
    public async Task HandleAsync_CalledTwice_IssuesDistinctBlobUrls()
    {
        _imageUpload
            .GenerateUploadUrlAsync(
                Arg.Any<ImageUploadScope>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<long>(), Arg.Any<CancellationToken>())
            .Returns(ci => new BlobUploadUrl("https://storage/upload", $"avatars/{ci.ArgAt<string>(1)}"));

        var first = CreateEndpoint(_userId, _profileId);
        var second = CreateEndpoint(_userId, _profileId);
        var request = new GenerateProfessionalAvatarUploadUrlRequest { ContentType = "image/jpeg", SizeBytes = 100 };

        await first.HandleAsync(request, CancellationToken.None);
        await second.HandleAsync(request, CancellationToken.None);

        first.Response.BlobUrl.Should().NotBe(second.Response.BlobUrl);
    }

    // ── Ownership isolation ─────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_TwoProfessionals_EachGetSubPathWithOwnProfileId()
    {
        var profAUserId = Guid.NewGuid();
        var profBUserId = Guid.NewGuid();
        const long profAId = 101L;
        const long profBId = 202L;

        var svc = Substitute.For<IImageUploadService>();
        svc
            .GenerateUploadUrlAsync(
                Arg.Any<ImageUploadScope>(),
                Arg.Any<string>(),
                Arg.Any<string>(),
                Arg.Any<long>(),
                Arg.Any<CancellationToken>())
            .Returns(ci => new BlobUploadUrl(
                "https://storage/upload",
                $"avatars/{ci.ArgAt<string>(1)}"));

        var epA = CreateEndpoint(profAUserId, profAId, svc);
        var epB = CreateEndpoint(profBUserId, profBId, svc);

        await epA.HandleAsync(new GenerateProfessionalAvatarUploadUrlRequest
        {
            ContentType = "image/jpeg",
            SizeBytes = 100
        }, CancellationToken.None);

        await epB.HandleAsync(new GenerateProfessionalAvatarUploadUrlRequest
        {
            ContentType = "image/jpeg",
            SizeBytes = 100
        }, CancellationToken.None);

        AvatarBlobKeys.TryParseProfessionalKey(epA.Response.BlobUrl, profAId, out _).Should().BeTrue();
        AvatarBlobKeys.TryParseProfessionalKey(epB.Response.BlobUrl, profBId, out _).Should().BeTrue();
        AvatarBlobKeys.TryParseProfessionalKey(epA.Response.BlobUrl, profBId, out _).Should().BeFalse();
        AvatarBlobKeys.TryParseProfessionalKey(epB.Response.BlobUrl, profAId, out _).Should().BeFalse();
    }

    // ── Profile not found (client without a professional profile) ──────────

    [Fact]
    public async Task HandleAsync_NoProfessionalProfile_Returns404()
    {
        // Empty ProfessionalProfiles set
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<GenerateProfessionalAvatarUploadUrlEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId, AppRoles.Trainer))),
            _imageUpload, db);

        await ep.HandleAsync(new GenerateProfessionalAvatarUploadUrlRequest
        {
            ContentType = "image/jpeg",
            SizeBytes = 1024
        }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
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

        var ep = CreateEndpoint(_userId, _profileId);

        var act = () => ep.HandleAsync(new GenerateProfessionalAvatarUploadUrlRequest
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

        var ep = CreateEndpoint(_userId, _profileId);

        var act = () => ep.HandleAsync(new GenerateProfessionalAvatarUploadUrlRequest
        {
            ContentType = "image/jpeg",
            SizeBytes = sixMb
        }, CancellationToken.None);

        var ex = await act.Should().ThrowAsync<ValidationFailureException>();
        ex.Which.Failures.Should()
            .ContainSingle(f => f.ErrorCode == ErrorCodes.ImageTooLarge);
    }
}
