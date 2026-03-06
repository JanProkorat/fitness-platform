using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Features.Auth.RefreshToken;
using FitnessPlatform.Tests.Builders;
using Microsoft.Extensions.Configuration;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Auth;

public class RefreshTokenEndpointTests
{
    private readonly Guid _userId = Guid.NewGuid();

    [Fact]
    public async Task HandleAsync_ValidToken_ReturnsNewTokenPair()
    {
        var user = EntityBuilder.User.WithId(_userId).Build();
        var token = EntityBuilder.RefreshToken.WithUser(user).WithToken("old-token").Build();

        var db = new MockDbBuilder().With(user).With(token).Build();

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.GetRolesAsync(Arg.Any<ApplicationUser>()).Returns(["Client"]);

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = new string('x', 64)
            })
            .Build();

        var ep = Factory.Create<RefreshTokenEndpoint>(db, userManager, config);

        await ep.HandleAsync(new RefreshTokenRequest { RefreshToken = "old-token" }, TestContext.Current.CancellationToken);

        ep.ValidationFailed.Should().BeFalse();
        ep.Response.AccessToken.Should().NotBeNullOrEmpty();
        ep.Response.RefreshToken.Should().NotBe("old-token");
    }

    [Fact]
    public async Task HandleAsync_InvalidToken_ThrowsError()
    {
        var db = new MockDbBuilder().Build();
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var config = new ConfigurationBuilder().AddInMemoryCollection().Build();

        var ep = Factory.Create<RefreshTokenEndpoint>(db, userManager, config);

        var act = () => ep.HandleAsync(new RefreshTokenRequest { RefreshToken = "nonexistent" }, CancellationToken.None);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }

    [Fact]
    public async Task HandleAsync_RevokedToken_ThrowsError()
    {
        var user = EntityBuilder.User.WithId(_userId).Build();
        var token = EntityBuilder.RefreshToken.WithUser(user).WithToken("revoked-token").Revoked().Build();

        var db = new MockDbBuilder().With(user).With(token).Build();
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var config = new ConfigurationBuilder().AddInMemoryCollection().Build();

        var ep = Factory.Create<RefreshTokenEndpoint>(db, userManager, config);

        var act = () => ep.HandleAsync(new RefreshTokenRequest { RefreshToken = "revoked-token" }, CancellationToken.None);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }

    [Fact]
    public async Task HandleAsync_ExpiredToken_ThrowsError()
    {
        var user = EntityBuilder.User.WithId(_userId).Build();
        var token = EntityBuilder.RefreshToken.WithUser(user).WithToken("expired-token").Expired().Build();

        var db = new MockDbBuilder().With(user).With(token).Build();
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var config = new ConfigurationBuilder().AddInMemoryCollection().Build();

        var ep = Factory.Create<RefreshTokenEndpoint>(db, userManager, config);

        var act = () => ep.HandleAsync(new RefreshTokenRequest { RefreshToken = "expired-token" }, CancellationToken.None);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }

    [Fact]
    public async Task HandleAsync_DeactivatedUser_ThrowsError()
    {
        var user = EntityBuilder.User.WithId(_userId).Inactive().Build();
        var token = EntityBuilder.RefreshToken.WithUser(user).WithToken("active-token").Build();

        var db = new MockDbBuilder().With(user).With(token).Build();
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var config = new ConfigurationBuilder().AddInMemoryCollection().Build();

        var ep = Factory.Create<RefreshTokenEndpoint>(db, userManager, config);

        var act = () => ep.HandleAsync(new RefreshTokenRequest { RefreshToken = "active-token" }, CancellationToken.None);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }

    [Fact]
    public async Task HandleAsync_RevokesOldToken()
    {
        var user = EntityBuilder.User.WithId(_userId).Build();
        var token = EntityBuilder.RefreshToken.WithUser(user).WithToken("old-token").Build();

        var db = new MockDbBuilder().With(user).With(token).Build();

        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.GetRolesAsync(Arg.Any<ApplicationUser>()).Returns(["Client"]);

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = new string('x', 64)
            })
            .Build();

        var ep = Factory.Create<RefreshTokenEndpoint>(db, userManager, config);

        await ep.HandleAsync(new RefreshTokenRequest { RefreshToken = "old-token" }, CancellationToken.None);

        token.RevokedAt.Should().NotBeNull();
        token.ReplacedByToken.Should().NotBeNullOrEmpty();
    }
}
