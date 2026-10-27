using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Users.Avatar;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace FitnessPlatform.Tests.Endpoints.Users.Avatar;

/// <summary>
/// Unit tests for <see cref="ConfirmAvatarEndpoint"/>.
/// </summary>
public class ConfirmAvatarEndpointTests
{
    private const string Hex = "0123456789abcdef0123456789abcdef";
    private const string OtherHex = "fedcba9876543210fedcba9876543210";

    private readonly Guid _userId = Guid.NewGuid();
    private readonly IImageUploadService _imageUpload = Substitute.For<IImageUploadService>();
    private readonly FakeBlobStorageService _blobStorage = new();
    private readonly ILogger<ConfirmAvatarEndpoint> _logger = Substitute.For<ILogger<ConfirmAvatarEndpoint>>();

    public ConfirmAvatarEndpointTests()
    {
        // The key-shape and owner checks under test run before the upload service, so a
        // permissive mock proves they reject on their own.
        _imageUpload
            .IsValidBlobUrlForSubPath(Arg.Any<ImageUploadScope>(), Arg.Any<string>(), Arg.Any<string>())
            .Returns(true);
    }

    private (ConfirmAvatarEndpoint Endpoint, UserManager<ApplicationUser> UserManager, ApplicationUser User) CreateEndpoint(
        string? previousAvatarUrl = null,
        IBlobStorageService? blobStorage = null)
    {
        var user = new ApplicationUser
        {
            Id = _userId, Email = "alice@test.com", UserName = "alice@test.com", AvatarBlobUrl = previousAvatarUrl
        };

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns(user);
        userManager.UpdateAsync(user).Returns(IdentityResult.Success);

        var endpoint = Factory.Create<ConfirmAvatarEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager, _imageUpload, blobStorage ?? _blobStorage, _logger);

        return (endpoint, userManager, user);
    }

    // ── Happy path ──────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_OwnUniqueKey_SavesUrlAndReturns204()
    {
        var (ep, userManager, user) = CreateEndpoint();
        var blobUrl = $"avatars/{_userId}-{Hex}.jpg";

        await ep.HandleAsync(new ConfirmAvatarRequest { BlobUrl = blobUrl }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        user.AvatarBlobUrl.Should().Be(blobUrl);
        user.DateUpdated.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
        await userManager.Received(1).UpdateAsync(user);
        _imageUpload.Received(1).IsValidBlobUrlForSubPath(
            ImageUploadScope.Avatar, $"{_userId}-{Hex}", blobUrl);
    }

    [Fact]
    public async Task HandleAsync_ReplacingLegacyAvatar_DeletesPreviousBlobAfterSave()
    {
        var previousUrl = $"avatars/{_userId}.jpg";
        var (ep, _, _) = CreateEndpoint(previousUrl);

        await ep.HandleAsync(
            new ConfirmAvatarRequest { BlobUrl = $"avatars/{_userId}-{Hex}.jpg" }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        _blobStorage.DeletedPaths.Should().ContainSingle().Which.Should().Be(previousUrl);
    }

    [Fact]
    public async Task HandleAsync_PreviousUrlEqualsNewUrl_DeletesNothing()
    {
        var blobUrl = $"avatars/{_userId}-{Hex}.jpg";
        var (ep, _, _) = CreateEndpoint(blobUrl);

        await ep.HandleAsync(new ConfirmAvatarRequest { BlobUrl = blobUrl }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        _blobStorage.DeletedPaths.Should().BeEmpty();
    }

    [Theory]
    [InlineData("https://seed.example.com/stock.jpg")]
    [InlineData("avatars/99999999-2222-3333-4444-555555555555.jpg")]
    public async Task HandleAsync_PreviousUrlNotOwnedByCaller_SavesNewUrlAndDeletesNothing(string previousUrl)
    {
        var (ep, _, user) = CreateEndpoint(previousUrl);
        var blobUrl = $"avatars/{_userId}-{OtherHex}.jpg";

        await ep.HandleAsync(new ConfirmAvatarRequest { BlobUrl = blobUrl }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        user.AvatarBlobUrl.Should().Be(blobUrl);
        _blobStorage.DeletedPaths.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleAsync_PreviousBlobDeleteThrows_StillSavesReturns204AndLogsWarning()
    {
        var blobStorage = Substitute.For<IBlobStorageService>();
        blobStorage.DeleteAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException("storage down"));
        var (ep, _, user) = CreateEndpoint($"avatars/{_userId}.jpg", blobStorage);
        var blobUrl = $"avatars/{_userId}-{Hex}.jpg";

        await ep.HandleAsync(new ConfirmAvatarRequest { BlobUrl = blobUrl }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
        user.AvatarBlobUrl.Should().Be(blobUrl);
        _logger.ReceivedCalls().Should().Contain(call =>
            call.GetMethodInfo().Name == nameof(ILogger.Log) && (LogLevel)call.GetArguments()[0]! == LogLevel.Warning);
    }

    // ── Stored-content injection (#658) ──────────────────────────────────────

    [Fact]
    public async Task HandleAsync_BlobUrlOfAnotherUser_Returns400_AndDoesNotPersistOrDelete()
    {
        var previousUrl = $"avatars/{_userId}.jpg";
        var (ep, userManager, user) = CreateEndpoint(previousUrl);

        await ep.HandleAsync(
            new ConfirmAvatarRequest { BlobUrl = $"avatars/{Guid.NewGuid()}-{Hex}.jpg" }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(400);
        user.AvatarBlobUrl.Should().Be(previousUrl);
        await userManager.DidNotReceive().UpdateAsync(Arg.Any<ApplicationUser>());
        _blobStorage.DeletedPaths.Should().BeEmpty();
    }

    [Theory]
    [InlineData("legacy")]
    [InlineData("nothex")]
    [InlineData("traversal")]
    [InlineData("external")]
    public async Task HandleAsync_MalformedKey_Returns400_AndDoesNotPersist(string kind)
    {
        var blobUrl = kind switch
        {
            "legacy" => $"avatars/{_userId}.jpg",
            "nothex" => $"avatars/{_userId}-nothexnothexnothexnothexnothex12.jpg",
            "traversal" => $"avatars/../{_userId}-{Hex}.jpg/..",
            _ => "https://evil.example.com/phishing.jpg",
        };
        var (ep, userManager, user) = CreateEndpoint();

        await ep.HandleAsync(new ConfirmAvatarRequest { BlobUrl = blobUrl }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(400);
        user.AvatarBlobUrl.Should().BeNull();
        await userManager.DidNotReceive().UpdateAsync(Arg.Any<ApplicationUser>());
        _blobStorage.DeletedPaths.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleAsync_UploadServiceRejectsFullUrl_Returns400_AndDoesNotPersist()
    {
        _imageUpload
            .IsValidBlobUrlForSubPath(Arg.Any<ImageUploadScope>(), Arg.Any<string>(), Arg.Any<string>())
            .Returns(false);
        var (ep, userManager, user) = CreateEndpoint();

        await ep.HandleAsync(
            new ConfirmAvatarRequest { BlobUrl = $"https://evil.example.com/{_userId}-{Hex}.jpg" },
            CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(400);
        user.AvatarBlobUrl.Should().BeNull();
        await userManager.DidNotReceive().UpdateAsync(Arg.Any<ApplicationUser>());
    }

    // ── Unauthenticated / not found ─────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var userManager = EndpointTestHelpers.CreateFakeUserManager();

        var ep = Factory.Create<ConfirmAvatarEndpoint>(userManager, _imageUpload, _blobStorage, _logger);

        await ep.HandleAsync(new ConfirmAvatarRequest { BlobUrl = "avatars/some.jpg" }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
        await userManager.DidNotReceive().UpdateAsync(Arg.Any<ApplicationUser>());
    }

    [Fact]
    public async Task HandleAsync_UserNotFound_Returns404()
    {
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns((ApplicationUser?)null);

        var ep = Factory.Create<ConfirmAvatarEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager, _imageUpload, _blobStorage, _logger);

        await ep.HandleAsync(
            new ConfirmAvatarRequest { BlobUrl = $"avatars/{_userId}-{Hex}.jpg" }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
        await userManager.DidNotReceive().UpdateAsync(Arg.Any<ApplicationUser>());
    }
}
