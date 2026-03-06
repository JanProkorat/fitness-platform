using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Features.Auth.Login;
using FitnessPlatform.Tests.Builders;
using Microsoft.Extensions.Configuration;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Auth;

public class LoginEndpointTests
{
    private readonly Guid _userId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ValidCredentials_ReturnsTokens()
    {
        var user = EntityBuilder.User.WithId(_userId).WithEmail("test@example.com")
            .WithFirstName("John").WithLastName("Doe").Build();

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByEmailAsync("test@example.com").Returns(user);
        userManager.CheckPasswordAsync(user, "TestPass1!").Returns(true);
        userManager.GetRolesAsync(user).Returns(["Client"]);

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = new string('x', 64),
                ["Jwt:AccessTokenExpirationMinutes"] = "15"
            })
            .Build();

        var db = new MockDbBuilder().Build();
        var ep = Factory.Create<LoginEndpoint>(userManager, db, config);

        await ep.HandleAsync(new LoginRequest
        {
            Email = "test@example.com",
            Password = "TestPass1!"
        }, TestContext.Current.CancellationToken);

        ep.ValidationFailed.Should().BeFalse();
        ep.Response.AccessToken.Should().NotBeNullOrEmpty();
        ep.Response.RefreshToken.Should().NotBeNullOrEmpty();
        ep.Response.ExpiresAt.Should().BeAfter(DateTime.UtcNow);
    }

    [Fact]
    public async Task HandleAsync_InvalidPassword_ThrowsError()
    {
        var user = EntityBuilder.User.WithId(_userId).WithEmail("test@example.com").Build();

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByEmailAsync("test@example.com").Returns(user);
        userManager.CheckPasswordAsync(user, "wrong").Returns(false);

        var config = new ConfigurationBuilder().AddInMemoryCollection().Build();
        var db = new MockDbBuilder().Build();
        var ep = Factory.Create<LoginEndpoint>(userManager, db, config);

        var act = () => ep.HandleAsync(new LoginRequest
        {
            Email = "test@example.com",
            Password = "wrong"
        }, CancellationToken.None);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }

    [Fact]
    public async Task HandleAsync_UserNotFound_ThrowsError()
    {
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByEmailAsync("missing@example.com").Returns((ApplicationUser?)null);

        var config = new ConfigurationBuilder().AddInMemoryCollection().Build();
        var db = new MockDbBuilder().Build();
        var ep = Factory.Create<LoginEndpoint>(userManager, db, config);

        var act = () => ep.HandleAsync(new LoginRequest
        {
            Email = "missing@example.com",
            Password = "TestPass1!"
        }, CancellationToken.None);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }

    [Fact]
    public async Task HandleAsync_DeactivatedAccount_ThrowsError()
    {
        var user = EntityBuilder.User.WithId(_userId).WithEmail("inactive@example.com").Inactive().Build();

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByEmailAsync("inactive@example.com").Returns(user);
        userManager.CheckPasswordAsync(user, "TestPass1!").Returns(true);

        var config = new ConfigurationBuilder().AddInMemoryCollection().Build();
        var db = new MockDbBuilder().Build();
        var ep = Factory.Create<LoginEndpoint>(userManager, db, config);

        var act = async () => await ep.HandleAsync(new LoginRequest
        {
            Email = "inactive@example.com",
            Password = "TestPass1!"
        }, CancellationToken.None);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }

    [Fact]
    public async Task HandleAsync_StoresRefreshTokenInDatabase()
    {
        var user = EntityBuilder.User.WithId(_userId).WithEmail("test@example.com").Build();

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.FindByEmailAsync("test@example.com").Returns(user);
        userManager.CheckPasswordAsync(user, "TestPass1!").Returns(true);
        userManager.GetRolesAsync(user).Returns(["Client"]);

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = new string('x', 64)
            })
            .Build();

        var db = new MockDbBuilder().Build();
        var ep = Factory.Create<LoginEndpoint>(userManager, db, config);

        await ep.HandleAsync(new LoginRequest
        {
            Email = "test@example.com",
            Password = "TestPass1!"
        }, TestContext.Current.CancellationToken);

        db.RefreshTokens.Received(1).Add(Arg.Is<RefreshToken>(t => t.UserId == _userId));
        await db.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
