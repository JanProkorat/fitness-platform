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

        // The atomic rotation goes through db.RotateRefreshTokenAsync (mocked to
        // succeed by default) rather than mutating the tracked entity directly.
        await db.Received(1).RotateRefreshTokenAsync(
            "old-token", Arg.Any<RefreshToken>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>());
    }

    // ── Grace-window reuse-detection discriminator ──────────────────────────

    /// <summary>
    /// A revoked-with-successor token presented again WITHIN the grace window is
    /// the legitimate concurrent double-fire path (e.g. an app-foreground retry
    /// racing its own successful request): reconcile benignly by minting a fresh
    /// access token and returning the already-issued successor. The family must
    /// NOT be revoked.
    /// </summary>
    [Fact]
    public async Task HandleAsync_RevokedTokenWithSuccessor_WithinGraceWindow_ReconcilesBenignly()
    {
        var user = EntityBuilder.User.WithId(_userId).Build();
        var token = EntityBuilder.RefreshToken.WithUser(user).WithToken("rotated-token")
            .WithRevokedAt(DateTime.UtcNow.AddSeconds(-5))
            .WithReplacedByToken("successor-token")
            .Build();

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

        await ep.HandleAsync(new RefreshTokenRequest { RefreshToken = "rotated-token" }, TestContext.Current.CancellationToken);

        ep.ValidationFailed.Should().BeFalse();
        ep.Response.AccessToken.Should().NotBeNullOrEmpty();
        ep.Response.RefreshToken.Should().Be("successor-token");

        await db.DidNotReceive().RevokeRefreshTokenFamilyAsync(
            Arg.Any<Guid>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// A revoked-with-successor token presented again OUTSIDE the grace window is
    /// genuine reuse/theft: revoke the whole token family for the user and reject.
    /// </summary>
    [Fact]
    public async Task HandleAsync_RevokedTokenWithSuccessor_OutsideGraceWindow_RevokesFamilyAndThrows()
    {
        var user = EntityBuilder.User.WithId(_userId).Build();
        var token = EntityBuilder.RefreshToken.WithUser(user).WithToken("stolen-token")
            .WithRevokedAt(DateTime.UtcNow.AddMinutes(-5))
            .WithReplacedByToken("successor-token")
            .Build();

        var db = new MockDbBuilder().With(user).With(token).Build();
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var config = new ConfigurationBuilder().AddInMemoryCollection().Build();

        var ep = Factory.Create<RefreshTokenEndpoint>(db, userManager, config);

        var act = () => ep.HandleAsync(new RefreshTokenRequest { RefreshToken = "stolen-token" }, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<ValidationFailureException>();

        await db.Received(1).RevokeRefreshTokenFamilyAsync(
            _userId, Arg.Any<DateTime>(), Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// A logout-revoked token (RevokedAt set, ReplacedByToken == null) must always
    /// be a plain reject, regardless of how long ago it was revoked — never theft.
    /// A normal logout must not be able to nuke every other active session.
    /// </summary>
    [Fact]
    public async Task HandleAsync_LogoutRevokedToken_NeverTriggersTheft()
    {
        var user = EntityBuilder.User.WithId(_userId).Build();
        var token = EntityBuilder.RefreshToken.WithUser(user).WithToken("logged-out-token")
            .WithRevokedAt(DateTime.UtcNow.AddSeconds(-2))
            .Build(); // ReplacedByToken stays null — this is a logout, not a rotation.

        var db = new MockDbBuilder().With(user).With(token).Build();
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var config = new ConfigurationBuilder().AddInMemoryCollection().Build();

        var ep = Factory.Create<RefreshTokenEndpoint>(db, userManager, config);

        var act = () => ep.HandleAsync(new RefreshTokenRequest { RefreshToken = "logged-out-token" }, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<ValidationFailureException>();

        await db.DidNotReceive().RevokeRefreshTokenFamilyAsync(
            Arg.Any<Guid>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// Simulates losing the atomic conditional-update rotation race: the initial
    /// read sees the token as still active, but the conditional UPDATE affects
    /// zero rows because a concurrent request already won. The loser must re-read
    /// the row and — since the concurrent winner is within the grace window —
    /// reconcile benignly instead of treating this as reuse.
    /// </summary>
    [Fact]
    public async Task HandleAsync_LosesAtomicRotationRace_WithinGraceWindow_ReconcilesBenignly()
    {
        var user = EntityBuilder.User.WithId(_userId).Build();
        var token = EntityBuilder.RefreshToken.WithUser(user).WithToken("raced-token").Build();

        var db = new MockDbBuilder().With(user).With(token).Build();
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        userManager.GetRolesAsync(Arg.Any<ApplicationUser>()).Returns(["Client"]);

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = new string('x', 64)
            })
            .Build();

        // Simulate a concurrent winner: the atomic conditional update loses
        // (returns 0 rows affected), and — as a real DB re-read would show —
        // the token is now revoked with a successor recorded, within the grace
        // window (mimicking the winner's own commit that just happened).
        db.RotateRefreshTokenAsync(
                "raced-token", Arg.Any<RefreshToken>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                token.RevokedAt = DateTime.UtcNow;
                token.ReplacedByToken = "concurrent-winner-token";
                return 0;
            });

        var ep = Factory.Create<RefreshTokenEndpoint>(db, userManager, config);

        await ep.HandleAsync(new RefreshTokenRequest { RefreshToken = "raced-token" }, TestContext.Current.CancellationToken);

        ep.ValidationFailed.Should().BeFalse();
        ep.Response.AccessToken.Should().NotBeNullOrEmpty();
        ep.Response.RefreshToken.Should().Be("concurrent-winner-token");

        await db.DidNotReceive().RevokeRefreshTokenFamilyAsync(
            Arg.Any<Guid>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// Same race as above, but the re-read shows the token was revoked well
    /// outside the grace window (an already-rotated token being replayed) — this
    /// must be classified as theft: revoke the family and reject.
    /// </summary>
    [Fact]
    public async Task HandleAsync_LosesAtomicRotationRace_OutsideGraceWindow_RevokesFamily()
    {
        var user = EntityBuilder.User.WithId(_userId).Build();
        var token = EntityBuilder.RefreshToken.WithUser(user).WithToken("raced-stolen-token").Build();

        var db = new MockDbBuilder().With(user).With(token).Build();
        var userManager = EndpointTestHelpers.CreateFakeUserManager();
        var config = new ConfigurationBuilder().AddInMemoryCollection().Build();

        db.RotateRefreshTokenAsync(
                "raced-stolen-token", Arg.Any<RefreshToken>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                token.RevokedAt = DateTime.UtcNow.AddMinutes(-5);
                token.ReplacedByToken = "already-rotated-successor";
                return 0;
            });

        var ep = Factory.Create<RefreshTokenEndpoint>(db, userManager, config);

        var act = () => ep.HandleAsync(new RefreshTokenRequest { RefreshToken = "raced-stolen-token" }, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<ValidationFailureException>();

        await db.Received(1).RevokeRefreshTokenFamilyAsync(
            _userId, Arg.Any<DateTime>(), Arg.Any<CancellationToken>());
    }
}
