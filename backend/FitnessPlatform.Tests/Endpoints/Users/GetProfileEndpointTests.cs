using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Features.Users.GetProfile;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Users;

public class GetProfileEndpointTests
{
    private readonly Guid _userId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_AuthenticatedUser_ReturnsProfile()
    {
        var user = new ApplicationUser
        {
            Id = _userId, Email = "test@test.com", UserName = "test@test.com",
            FirstName = "John", LastName = "Doe"
        };

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns(user);
        userManager.GetRolesAsync(user).Returns(["Client"]);

        var ep = Factory.Create<GetProfileEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager);

        await ep.HandleAsync(CancellationToken.None);

        ep.Response.Email.Should().Be("test@test.com");
        ep.Response.FirstName.Should().Be("John");
        ep.Response.LastName.Should().Be("Doe");
        ep.Response.Roles.Should().Contain("Client");
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var userManager = EndpointTestHelpers.CreateFakeUserManager();

        var ep = Factory.Create<GetProfileEndpoint>(userManager);

        await ep.HandleAsync(CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_UserNotInDb_Returns404()
    {
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns((ApplicationUser?)null);

        var ep = Factory.Create<GetProfileEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager);

        await ep.HandleAsync(CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
