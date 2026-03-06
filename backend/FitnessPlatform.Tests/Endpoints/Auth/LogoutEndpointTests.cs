using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Features.Auth.Logout;
using FitnessPlatform.Tests.Builders;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Auth;

public class LogoutEndpointTests
{
    [Fact]
    public async Task HandleAsync_ValidToken_RevokesIt()
    {
        var token = EntityBuilder.RefreshToken.WithToken("active-token").Build();
        var db = new MockDbBuilder().With(token).Build();

        var ep = Factory.Create<LogoutEndpoint>(db);

        await ep.HandleAsync(new LogoutRequest { RefreshToken = "active-token" }, TestContext.Current.CancellationToken);

        token.RevokedAt.Should().NotBeNull();
        await db.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NonexistentToken_Returns204Anyway()
    {
        var db = new MockDbBuilder().Build();
        var ep = Factory.Create<LogoutEndpoint>(db);

        await ep.HandleAsync(new LogoutRequest { RefreshToken = "nonexistent" }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
    }

    [Fact]
    public async Task HandleAsync_AlreadyRevokedToken_Returns204()
    {
        var token = EntityBuilder.RefreshToken.WithToken("revoked-token").Revoked().Build();
        var db = new MockDbBuilder().With(token).Build();

        var ep = Factory.Create<LogoutEndpoint>(db);

        await ep.HandleAsync(new LogoutRequest { RefreshToken = "revoked-token" }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(204);
    }
}
