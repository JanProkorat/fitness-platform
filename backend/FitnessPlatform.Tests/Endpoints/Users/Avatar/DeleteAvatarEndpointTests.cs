using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Features.Users.Avatar;
using Microsoft.AspNetCore.Identity;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Users.Avatar;

/// <summary>
/// Unit tests for <see cref="DeleteAvatarEndpoint"/>.
/// </summary>
public class DeleteAvatarEndpointTests
{
    private readonly Guid _userId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_AuthenticatedUser_ClearsAvatarBlobUrl()
    {
        var user = new ApplicationUser
        {
            Id = _userId, Email = "alice@test.com", UserName = "alice@test.com",
            AvatarBlobUrl = "avatars/existing.jpg"
        };

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns(user);
        userManager.UpdateAsync(user).Returns(IdentityResult.Success);

        var ep = Factory.Create<DeleteAvatarEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager);

        await ep.HandleAsync(CancellationToken.None);

        user.AvatarBlobUrl.Should().BeNull();
        ep.HttpContext.Response.StatusCode.Should().Be(204);
        await userManager.Received(1).UpdateAsync(user);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var userManager = EndpointTestHelpers.CreateFakeUserManager();

        var ep = Factory.Create<DeleteAvatarEndpoint>(userManager);

        await ep.HandleAsync(CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
        await userManager.DidNotReceive().UpdateAsync(Arg.Any<ApplicationUser>());
    }

    [Fact]
    public async Task HandleAsync_UserNotFound_Returns404()
    {
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns((ApplicationUser?)null);

        var ep = Factory.Create<DeleteAvatarEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager);

        await ep.HandleAsync(CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
        await userManager.DidNotReceive().UpdateAsync(Arg.Any<ApplicationUser>());
    }
}
