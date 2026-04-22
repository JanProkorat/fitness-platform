using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
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
            db);

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
            db);

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
            dbA);

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

        var ep = Factory.Create<ConfirmProfessionalAvatarEndpoint>(db);

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
            db);

        await ep.HandleAsync(new ConfirmProfessionalAvatarRequest
        {
            BlobUrl = "avatars/prof-42.jpg"
        }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
        await db.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
