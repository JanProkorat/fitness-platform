using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Features.Professionals.Avatar;
using FitnessPlatform.Tests.Builders;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Professionals.Avatar;

/// <summary>
/// Unit tests for <see cref="DeleteProfessionalAvatarEndpoint"/>.
/// </summary>
public class DeleteProfessionalAvatarEndpointTests
{
    private readonly Guid _userId = Guid.NewGuid();
    private readonly long _profileId = 42L;

    // ── Happy path ──────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_AuthenticatedProfessional_ClearsAvatarBlobUrl()
    {
        var profile = new ProfessionalProfile
        {
            Id = _profileId, UserId = _userId, AvatarBlobUrl = "avatars/prof-42.jpg"
        };
        var db = new MockDbBuilder().With(profile).Build();

        var ep = Factory.Create<DeleteProfessionalAvatarEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId, AppRoles.Trainer))),
            db);

        await ep.HandleAsync(CancellationToken.None);

        profile.AvatarBlobUrl.Should().BeNull();
        ep.HttpContext.Response.StatusCode.Should().Be(204);
        await db.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // ── Unauthenticated ─────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var db = new MockDbBuilder()
            .With(new ProfessionalProfile { Id = _profileId, UserId = _userId })
            .Build();

        var ep = Factory.Create<DeleteProfessionalAvatarEndpoint>(db);

        await ep.HandleAsync(CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
        await db.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // ── Profile not found ─────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NoProfessionalProfile_Returns404()
    {
        // Empty ProfessionalProfiles set
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<DeleteProfessionalAvatarEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId, AppRoles.Trainer))),
            db);

        await ep.HandleAsync(CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
        await db.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
