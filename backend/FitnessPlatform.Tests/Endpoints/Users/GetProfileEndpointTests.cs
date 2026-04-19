using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Features.Users.GetProfile;
using FitnessPlatform.Tests.Builders;
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

        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<GetProfileEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager, db);

        await ep.HandleAsync(CancellationToken.None);

        ep.Response.Email.Should().Be("test@test.com");
        ep.Response.FirstName.Should().Be("John");
        ep.Response.LastName.Should().Be("Doe");
        ep.Response.Roles.Should().Contain("Client");
        ep.Response.TimeZone.Should().Be("Europe/Prague");
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<GetProfileEndpoint>(userManager, db);

        await ep.HandleAsync(CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_UserNotInDb_Returns404()
    {
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns((ApplicationUser?)null);

        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<GetProfileEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager, db);

        await ep.HandleAsync(CancellationToken.None);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task ClientUser_ReturnsIsOnboardingComplete_False()
    {
        var user = new ApplicationUser
        {
            Id = _userId, Email = "test@test.com", UserName = "test@test.com",
            FirstName = "John", LastName = "Doe"
        };

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns(user);
        userManager.GetRolesAsync(user).Returns(new List<string> { "Client" });

        var clientProfile = EntityBuilder.ClientProfile.WithUserId(_userId).Build();
        var db = new MockDbBuilder().With(clientProfile).Build();

        var ep = Factory.Create<GetProfileEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager, db);

        await ep.HandleAsync(CancellationToken.None);

        ep.Response.IsOnboardingComplete.Should().BeFalse();
    }

    [Fact]
    public async Task ClientUser_WithCompletedOnboarding_ReturnsTrue()
    {
        var user = new ApplicationUser
        {
            Id = _userId, Email = "test@test.com", UserName = "test@test.com",
            FirstName = "John", LastName = "Doe"
        };

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns(user);
        userManager.GetRolesAsync(user).Returns(new List<string> { "Client" });

        var clientProfile = EntityBuilder.ClientProfile.WithUserId(_userId).Build();
        clientProfile.IsOnboardingComplete = true;
        var db = new MockDbBuilder().With(clientProfile).Build();

        var ep = Factory.Create<GetProfileEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId))),
            userManager, db);

        await ep.HandleAsync(CancellationToken.None);

        ep.Response.IsOnboardingComplete.Should().BeTrue();
    }

    [Fact]
    public async Task NonClientUser_ReturnsIsOnboardingComplete_Null()
    {
        var user = new ApplicationUser
        {
            Id = _userId, Email = "test@test.com", UserName = "test@test.com",
            FirstName = "John", LastName = "Doe"
        };

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByIdAsync(_userId.ToString()).Returns(user);
        userManager.GetRolesAsync(user).Returns(new List<string> { "Trainer" });

        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<GetProfileEndpoint>(
            ctx => ctx.Request.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
                new System.Security.Claims.ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_userId, AppRoles.Trainer))),
            userManager, db);

        await ep.HandleAsync(CancellationToken.None);

        ep.Response.IsOnboardingComplete.Should().BeNull();
    }
}
