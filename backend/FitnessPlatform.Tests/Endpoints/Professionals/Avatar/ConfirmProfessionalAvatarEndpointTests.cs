using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Professionals.Avatar;
using FitnessPlatform.Tests.Builders;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Professionals.Avatar;

/// <summary>
/// Unit tests for <see cref="ConfirmProfessionalAvatarEndpoint"/>.
/// </summary>
public class ConfirmProfessionalAvatarEndpointTests
{
    private readonly Guid _userId = Guid.NewGuid();
    private readonly long _profileId = 42L;
    private readonly IImageUploadService _imageUpload = Substitute.For<IImageUploadService>();

    public ConfirmProfessionalAvatarEndpointTests()
    {
        // Default: any blobUrl is accepted unless a specific test configures otherwise.
        // The rejection path (#658) is exercised by dedicated tests below with their own mock.
        _imageUpload
            .IsValidBlobUrlForSubPath(Arg.Any<ImageUploadScope>(), Arg.Any<string>(), Arg.Any<string>())
            .Returns(true);
    }

    // ── Happy path ──────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_AuthenticatedProfessional_SetsAvatarBlobUrl()
    {
        var profile = new ProfessionalProfile { Id = _profileId, UserId = _userId };
        var db = new MockDbBuilder().With(profile).Build();
        const string blobUrl = "avatars/prof-42.jpg";

        var ep = Factory.Create<ConfirmProfessionalAvatarEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId, AppRoles.Trainer))),
            db, _imageUpload);

        await ep.HandleAsync(new ConfirmProfessionalAvatarRequest
        {
            BlobUrl = blobUrl
        }, CancellationToken.None);

        profile.AvatarBlobUrl.Should().Be(blobUrl);
        await db.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_AuthenticatedProfessional_Returns204()
    {
        var profile = new ProfessionalProfile { Id = _profileId, UserId = _userId };
        var db = new MockDbBuilder().With(profile).Build();

        var ep = Factory.Create<ConfirmProfessionalAvatarEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId, AppRoles.Trainer))),
            db, _imageUpload);

        await ep.HandleAsync(new ConfirmProfessionalAvatarRequest
        {
            BlobUrl = "avatars/prof-42.jpg"
        }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
    }

    // ── Ownership isolation ─────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_ProfA_DoesNotAffectProfB_AvatarBlobUrl()
    {
        var profAUserId = Guid.NewGuid();
        var profBUserId = Guid.NewGuid();

        var profA = new ProfessionalProfile { Id = 101L, UserId = profAUserId };
        var profB = new ProfessionalProfile { Id = 202L, UserId = profBUserId };

        // ProfA has its own isolated db context with only profA in it
        var dbA = new MockDbBuilder().With(profA).Build();

        var epA = Factory.Create<ConfirmProfessionalAvatarEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(profAUserId, AppRoles.Trainer))),
            dbA, _imageUpload);

        await epA.HandleAsync(new ConfirmProfessionalAvatarRequest
        {
            BlobUrl = $"avatars/prof-{profA.Id}.jpg"
        }, CancellationToken.None);

        // ProfA has avatar; profB object is untouched
        profA.AvatarBlobUrl.Should().Be($"avatars/prof-{profA.Id}.jpg");
        profB.AvatarBlobUrl.Should().BeNull();
    }

    // ── Unauthenticated ─────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var db = new MockDbBuilder()
            .With(new ProfessionalProfile { Id = _profileId, UserId = _userId })
            .Build();

        var ep = Factory.Create<ConfirmProfessionalAvatarEndpoint>(db, _imageUpload);

        await ep.HandleAsync(new ConfirmProfessionalAvatarRequest
        {
            BlobUrl = "avatars/prof-42.jpg"
        }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
        await db.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // ── Profile not found ─────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NoProfessionalProfile_Returns404()
    {
        // Empty ProfessionalProfiles set
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<ConfirmProfessionalAvatarEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId, AppRoles.Trainer))),
            db, _imageUpload);

        await ep.HandleAsync(new ConfirmProfessionalAvatarRequest
        {
            BlobUrl = "avatars/prof-42.jpg"
        }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
        await db.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // ── Stored-content injection (#658) ──────────────────────────────────────

    [Fact]
    public async Task HandleAsync_BlobUrlDoesNotMatchCallerProfileKey_Returns400_AndDoesNotPersist()
    {
        var profile = new ProfessionalProfile { Id = _profileId, UserId = _userId };
        var db = new MockDbBuilder().With(profile).Build();

        // Simulate: another professional's key, or a foreign/attacker URL — the real
        // service would only accept "avatars/prof-{profile.Id}.{ext}" for this caller.
        var imageUpload = Substitute.For<IImageUploadService>();
        imageUpload
            .IsValidBlobUrlForSubPath(Arg.Any<ImageUploadScope>(), Arg.Any<string>(), Arg.Any<string>())
            .Returns(false);

        var ep = Factory.Create<ConfirmProfessionalAvatarEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId, AppRoles.Trainer))),
            db, imageUpload);

        await ep.HandleAsync(new ConfirmProfessionalAvatarRequest
        {
            BlobUrl = "https://evil.example.com/phishing.jpg"
        }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(400);
        profile.AvatarBlobUrl.Should().BeNull();
        await db.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_ValidBlobUrl_ChecksAvatarScopeWithCallerOwnProfileId()
    {
        var profile = new ProfessionalProfile { Id = _profileId, UserId = _userId };
        var db = new MockDbBuilder().With(profile).Build();

        var imageUpload = Substitute.For<IImageUploadService>();
        imageUpload
            .IsValidBlobUrlForSubPath(Arg.Any<ImageUploadScope>(), Arg.Any<string>(), Arg.Any<string>())
            .Returns(true);

        var ep = Factory.Create<ConfirmProfessionalAvatarEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId, AppRoles.Trainer))),
            db, imageUpload);

        const string blobUrl = "avatars/prof-42-something.jpg";
        await ep.HandleAsync(new ConfirmProfessionalAvatarRequest { BlobUrl = blobUrl }, CancellationToken.None);

        // The endpoint must check the caller's OWN DB-resolved profile.Id (not the userId,
        // not a client-supplied value) as the sub-path prefix — the identity check belongs
        // in HandleAsync, not the validator (which cannot resolve the profile).
        imageUpload.Received(1).IsValidBlobUrlForSubPath(
            ImageUploadScope.Avatar, $"prof-{_profileId}", blobUrl);
    }
}
