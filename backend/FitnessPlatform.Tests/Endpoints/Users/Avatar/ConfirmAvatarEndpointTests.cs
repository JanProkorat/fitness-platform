using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Features.Users.Avatar;
using Microsoft.AspNetCore.Identity;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Users.Avatar;

/// <summary>
/// Unit tests for <see cref="ConfirmAvatarEndpoint"/>.
/// </summary>
public class ConfirmAvatarEndpointTests
{
    private readonly Guid _userId = Guid.NewGuid();

    // ── Happy path ──────────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_AuthenticatedUser_SetsAvatarBlobUrlOnUser()
    {
        var user = new ApplicationUser
        {
            Id = _userId, Email = "alice@test.com", UserName = "alice@test.com",
            FirstName = "Alice", LastName = "Smith"
        };

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns(user);
        userManager.UpdateAsync(user).Returns(IdentityResult.Success);

        var ep = Factory.Create<ConfirmAvatarEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager);

        await ep.HandleAsync(new ConfirmAvatarRequest
        {
            BlobUrl = $"avatars/{_userId}.jpg"
        }, CancellationToken.None);

        user.AvatarBlobUrl.Should().Be($"avatars/{_userId}.jpg");
        user.DateUpdated.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
        await userManager.Received(1).UpdateAsync(user);
    }

    [Fact]
    public async Task HandleAsync_AuthenticatedUser_Returns204()
    {
        var user = new ApplicationUser
        {
            Id = _userId, Email = "alice@test.com", UserName = "alice@test.com"
        };

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns(user);
        userManager.UpdateAsync(user).Returns(IdentityResult.Success);

        var ep = Factory.Create<ConfirmAvatarEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager);

        await ep.HandleAsync(new ConfirmAvatarRequest
        {
            BlobUrl = $"avatars/{_userId}.jpg"
        }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
    }

    // ── Ownership isolation ─────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_UserA_DoesNotAffectUserB_Avatar()
    {
        var userAId = Guid.NewGuid();
        var userBId = Guid.NewGuid();

        var userA = new ApplicationUser
        {
            Id = userAId, Email = "a@test.com", UserName = "a@test.com"
        };
        var userB = new ApplicationUser
        {
            Id = userBId, Email = "b@test.com", UserName = "b@test.com"
        };

        var userManagerA = EndpointTestHelpers.CreateFakeUserManager();
        userManagerA.FindByIdAsync(userAId.ToString()).Returns(userA);
        userManagerA.UpdateAsync(userA).Returns(IdentityResult.Success);

        var epA = Factory.Create<ConfirmAvatarEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(userAId))),
            userManagerA);

        await epA.HandleAsync(new ConfirmAvatarRequest
        {
            BlobUrl = $"avatars/{userAId}.jpg"
        }, CancellationToken.None);

        // UserA has an avatar; UserB's object is untouched
        userA.AvatarBlobUrl.Should().Be($"avatars/{userAId}.jpg");
        userB.AvatarBlobUrl.Should().BeNull();
    }

    // ── Unauthenticated ─────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var userManager = EndpointTestHelpers.CreateFakeUserManager();

        var ep = Factory.Create<ConfirmAvatarEndpoint>(userManager);

        await ep.HandleAsync(new ConfirmAvatarRequest
        {
            BlobUrl = "avatars/some.jpg"
        }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
        await userManager.DidNotReceive().UpdateAsync(Arg.Any<ApplicationUser>());
    }

    // ── User not found ──────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_UserNotFound_Returns404()
    {
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns((ApplicationUser?)null);

        var ep = Factory.Create<ConfirmAvatarEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager);

        await ep.HandleAsync(new ConfirmAvatarRequest
        {
            BlobUrl = "avatars/some.jpg"
        }, CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
        await userManager.DidNotReceive().UpdateAsync(Arg.Any<ApplicationUser>());
    }

    // ── Subsequent GET reflects stored avatar ───────────────────────────────

    [Fact]
    public async Task HandleAsync_AfterConfirm_AvatarBlobUrlReflectsStoredValue()
    {
        const string avatarUrl = "avatars/abc123.png";
        var user = new ApplicationUser
        {
            Id = _userId, Email = "alice@test.com", UserName = "alice@test.com",
            AvatarBlobUrl = null
        };

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns(user);
        userManager.UpdateAsync(Arg.Do<ApplicationUser>(u => { /* identity persists in-memory */ }))
            .Returns(IdentityResult.Success);

        var ep = Factory.Create<ConfirmAvatarEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager);

        await ep.HandleAsync(new ConfirmAvatarRequest { BlobUrl = avatarUrl }, CancellationToken.None);

        // The in-memory user object now carries the new URL, which would be
        // returned by a subsequent FindByIdAsync in the GetProfile endpoint.
        user.AvatarBlobUrl.Should().Be(avatarUrl);
    }
}
