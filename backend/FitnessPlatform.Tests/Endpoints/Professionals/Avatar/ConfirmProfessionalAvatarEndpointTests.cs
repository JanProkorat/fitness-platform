using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Professionals.Avatar;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.Extensions.Logging;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace FitnessPlatform.Tests.Endpoints.Professionals.Avatar;

/// <summary>
/// Unit tests for <see cref="ConfirmProfessionalAvatarEndpoint"/>.
/// </summary>
public class ConfirmProfessionalAvatarEndpointTests
{
    private const string Hex = "0123456789abcdef0123456789abcdef";
    private const string OtherHex = "fedcba9876543210fedcba9876543210";

    private readonly Guid _userId = Guid.NewGuid();
    private readonly long _profileId = 42L;
    private readonly IImageUploadService _imageUpload = Substitute.For<IImageUploadService>();
    private readonly FakeBlobStorageService _blobStorage = new();
    private readonly ILogger<ConfirmProfessionalAvatarEndpoint> _logger = Substitute.For<ILogger<ConfirmProfessionalAvatarEndpoint>>();

    public ConfirmProfessionalAvatarEndpointTests()
    {
        // The identity check on the full URL is the upload service's job; the key-shape and owner
        // checks under test run before it, so a permissive mock proves they reject on their own.
        _imageUpload
            .IsValidBlobUrlForSubPath(Arg.Any<ImageUploadScope>(), Arg.Any<string>(), Arg.Any<string>())
            .Returns(true);
    }

    private ConfirmProfessionalAvatarEndpoint CreateEndpoint(
        IApplicationDbContext db,
        IBlobStorageService? blobStorage = null) =>
        Factory.Create<ConfirmProfessionalAvatarEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId, AppRoles.Trainer))),
            db, _imageUpload, blobStorage ?? _blobStorage, _logger);

    // ── Happy path ──────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_OwnUniqueKey_SavesUrlAndReturns204()
    {
        var profile = new ProfessionalProfile { Id = _profileId, UserId = _userId };
        var db = new MockDbBuilder().With(profile).Build();
        var blobUrl = $"avatars/prof-{_profileId}-{Hex}.jpg";

        var ep = CreateEndpoint(db);

        await ep.HandleAsync(new ConfirmProfessionalAvatarRequest { BlobUrl = blobUrl }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        profile.AvatarBlobUrl.Should().Be(blobUrl);
        await db.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
        _imageUpload.Received(1).IsValidBlobUrlForSubPath(
            ImageUploadScope.Avatar, $"prof-{_profileId}-{Hex}", blobUrl);
    }

    [Theory]
    [InlineData("avatars/prof-42.jpg")]
    [InlineData("avatars/prof-42-" + OtherHex + ".png")]
    public async Task HandleAsync_ReplacingOwnPreviousAvatar_DeletesPreviousBlobAfterSave(string previousUrl)
    {
        var profile = new ProfessionalProfile { Id = _profileId, UserId = _userId, AvatarBlobUrl = previousUrl };
        var db = new MockDbBuilder().With(profile).Build();

        var ep = CreateEndpoint(db);

        await ep.HandleAsync(
            new ConfirmProfessionalAvatarRequest { BlobUrl = $"avatars/prof-{_profileId}-{Hex}.jpg" },
            CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        _blobStorage.DeletedPaths.Should().ContainSingle().Which.Should().Be(previousUrl);
    }

    [Fact]
    public async Task HandleAsync_PreviousUrlEqualsNewUrl_DeletesNothing()
    {
        var blobUrl = $"avatars/prof-{_profileId}-{Hex}.jpg";
        var profile = new ProfessionalProfile { Id = _profileId, UserId = _userId, AvatarBlobUrl = blobUrl };
        var db = new MockDbBuilder().With(profile).Build();

        var ep = CreateEndpoint(db);

        await ep.HandleAsync(new ConfirmProfessionalAvatarRequest { BlobUrl = blobUrl }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        _blobStorage.DeletedPaths.Should().BeEmpty();
    }

    [Theory]
    [InlineData("https://seed.example.com/avatars/stock.jpg")]
    [InlineData("avatars/prof-420.jpg")]
    [InlineData("avatars/prof-4-" + OtherHex + ".jpg")]
    public async Task HandleAsync_PreviousUrlNotOwnedByCaller_SavesNewUrlAndDeletesNothing(string previousUrl)
    {
        var profile = new ProfessionalProfile { Id = _profileId, UserId = _userId, AvatarBlobUrl = previousUrl };
        var db = new MockDbBuilder().With(profile).Build();
        var blobUrl = $"avatars/prof-{_profileId}-{Hex}.jpg";

        var ep = CreateEndpoint(db);

        await ep.HandleAsync(new ConfirmProfessionalAvatarRequest { BlobUrl = blobUrl }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        profile.AvatarBlobUrl.Should().Be(blobUrl);
        _blobStorage.DeletedPaths.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleAsync_PreviousBlobDeleteThrows_StillSavesReturns204AndLogsWarning()
    {
        var profile = new ProfessionalProfile
        {
            Id = _profileId, UserId = _userId, AvatarBlobUrl = "avatars/prof-42.jpg"
        };
        var db = new MockDbBuilder().With(profile).Build();
        var blobStorage = Substitute.For<IBlobStorageService>();
        blobStorage.DeleteAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException("storage down"));
        var blobUrl = $"avatars/prof-{_profileId}-{Hex}.jpg";

        var ep = CreateEndpoint(db, blobStorage);

        await ep.HandleAsync(new ConfirmProfessionalAvatarRequest { BlobUrl = blobUrl }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        profile.AvatarBlobUrl.Should().Be(blobUrl);
        await db.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
        _logger.ReceivedCalls().Should().Contain(call =>
            call.GetMethodInfo().Name == nameof(ILogger.Log) && (LogLevel)call.GetArguments()[0]! == LogLevel.Warning);
    }

    // ── Stored-content injection (#658) ──────────────────────────────────────

    [Theory]
    [InlineData("avatars/prof-1-" + Hex + ".jpg", 12L)]
    [InlineData("avatars/prof-12-" + Hex + ".jpg", 1L)]
    [InlineData("avatars/prof-777-" + Hex + ".jpg", 42L)]
    public async Task HandleAsync_BlobUrlOfAnotherProfile_Returns400_AndDoesNotPersistOrDelete(
        string blobUrl, long callerProfileId)
    {
        var profile = new ProfessionalProfile
        {
            Id = callerProfileId, UserId = _userId, AvatarBlobUrl = $"avatars/prof-{callerProfileId}.jpg"
        };
        var db = new MockDbBuilder().With(profile).Build();

        var ep = CreateEndpoint(db);

        await ep.HandleAsync(new ConfirmProfessionalAvatarRequest { BlobUrl = blobUrl }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(400);
        profile.AvatarBlobUrl.Should().Be($"avatars/prof-{callerProfileId}.jpg");
        await db.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
        _blobStorage.DeletedPaths.Should().BeEmpty();
    }

    [Theory]
    [InlineData("avatars/prof-42.jpg")]
    [InlineData("avatars/prof-42-nothexnothexnothexnothexnothex12.jpg")]
    [InlineData("avatars/../prof-42-" + Hex + ".jpg/..")]
    [InlineData("https://evil.example.com/phishing.jpg")]
    public async Task HandleAsync_MalformedKey_Returns400_AndDoesNotPersist(string blobUrl)
    {
        var profile = new ProfessionalProfile { Id = _profileId, UserId = _userId };
        var db = new MockDbBuilder().With(profile).Build();

        var ep = CreateEndpoint(db);

        await ep.HandleAsync(new ConfirmProfessionalAvatarRequest { BlobUrl = blobUrl }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(400);
        profile.AvatarBlobUrl.Should().BeNull();
        await db.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
        _blobStorage.DeletedPaths.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleAsync_UploadServiceRejectsFullUrl_Returns400_AndDoesNotPersist()
    {
        var profile = new ProfessionalProfile { Id = _profileId, UserId = _userId };
        var db = new MockDbBuilder().With(profile).Build();
        _imageUpload
            .IsValidBlobUrlForSubPath(Arg.Any<ImageUploadScope>(), Arg.Any<string>(), Arg.Any<string>())
            .Returns(false);

        var ep = CreateEndpoint(db);

        await ep.HandleAsync(
            new ConfirmProfessionalAvatarRequest { BlobUrl = $"https://evil.example.com/prof-{_profileId}-{Hex}.jpg" },
            CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(400);
        profile.AvatarBlobUrl.Should().BeNull();
        await db.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // ── Profile not found ─────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NoProfessionalProfile_Returns404()
    {
        // Empty ProfessionalProfiles set
        var db = new MockDbBuilder().Build();

        var ep = CreateEndpoint(db);

        await ep.HandleAsync(
            new ConfirmProfessionalAvatarRequest { BlobUrl = $"avatars/prof-{_profileId}-{Hex}.jpg" },
            CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
        await db.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
        _blobStorage.DeletedPaths.Should().BeEmpty();
    }
}
