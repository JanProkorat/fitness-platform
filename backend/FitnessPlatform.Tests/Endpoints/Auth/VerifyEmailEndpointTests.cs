using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.Auth.VerifyEmail;
using FitnessPlatform.Tests.Builders;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.Auth;

/// <summary>
/// Tests for <see cref="VerifyEmailEndpoint"/>, in particular the pending-invite
/// conversation seed (#803/#817, moved here from RegisterEndpoint for #1100 — R4: invite
/// threads exist only for VERIFIED accounts).
/// </summary>
public class VerifyEmailEndpointTests
{
    private readonly IRealtimeNotifier _notifier = Substitute.For<IRealtimeNotifier>();
    private readonly IPendingInviteConversationSeeder _inviteConversationSeeder = Substitute.For<IPendingInviteConversationSeeder>();
    private readonly ILogger<VerifyEmailEndpoint> _logger = Substitute.For<ILogger<VerifyEmailEndpoint>>();

    private static ApplicationUser CreateUser(Guid id, string email) => new()
    {
        Id = id,
        Email = email,
        NormalizedEmail = email.ToUpperInvariant(),
        FirstName = "John",
        LastName = "Doe",
        EmailConfirmed = false
    };

    private VerifyEmailEndpoint CreateEndpoint(Application.Infrastructure.Data.IApplicationDbContext db) =>
        Factory.Create<VerifyEmailEndpoint>(db, _notifier, _inviteConversationSeeder, _logger);

    [Fact]
    public async Task HandleAsync_ValidToken_ConfirmsEmail_AndNotifies()
    {
        var userId = Guid.NewGuid();
        var user = CreateUser(userId, "client@example.com");
        var token = new EmailVerificationToken
        {
            UserId = userId,
            User = user,
            Token = "valid-token",
            ExpiresAt = DateTime.UtcNow.AddHours(1)
        };

        var db = new MockDbBuilder().With(user).With(token).Build();
        var ep = CreateEndpoint(db);

        await ep.HandleAsync(new VerifyEmailRequest { Token = "valid-token" }, TestContext.Current.CancellationToken);

        ep.ValidationFailed.Should().BeFalse();
        user.EmailConfirmed.Should().BeTrue();
        token.UsedAt.Should().NotBeNull();
        await _notifier.Received(1).NotifyAsync(userId, "emailverified", Arg.Any<object>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_InvalidToken_ThrowsError()
    {
        var db = new MockDbBuilder().Build();
        var ep = CreateEndpoint(db);

        var act = () => ep.HandleAsync(new VerifyEmailRequest { Token = "nonexistent" }, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<ValidationFailureException>();
        await _inviteConversationSeeder.DidNotReceiveWithAnyArgs().SeedForNewUserAsync(
            default!, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task HandleAsync_ExpiredToken_ThrowsError()
    {
        var userId = Guid.NewGuid();
        var user = CreateUser(userId, "client@example.com");
        var token = new EmailVerificationToken
        {
            UserId = userId,
            User = user,
            Token = "expired-token",
            ExpiresAt = DateTime.UtcNow.AddHours(-1)
        };

        var db = new MockDbBuilder().With(user).With(token).Build();
        var ep = CreateEndpoint(db);

        var act = () => ep.HandleAsync(new VerifyEmailRequest { Token = "expired-token" }, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<ValidationFailureException>();
    }

    /// <summary>
    /// A Client-role account (has a ClientProfile) must run the pending-invite conversation
    /// seed once verified, so any coach's opening message already addressed to this email is
    /// surfaced before the client explicitly accepts (#803/#817, moved from RegisterEndpoint
    /// for #1100/R4).
    /// </summary>
    [Fact]
    public async Task HandleAsync_ClientAccount_SeedsPendingInviteConversations()
    {
        var userId = Guid.NewGuid();
        var user = CreateUser(userId, "invited-client@example.com");
        var clientProfile = new ClientProfile { Id = 1, UserId = userId };
        var token = new EmailVerificationToken
        {
            UserId = userId,
            User = user,
            Token = "client-token",
            ExpiresAt = DateTime.UtcNow.AddHours(1)
        };

        var db = new MockDbBuilder().With(user).With(clientProfile).With(token).Build();
        var ep = CreateEndpoint(db);

        await ep.HandleAsync(new VerifyEmailRequest { Token = "client-token" }, TestContext.Current.CancellationToken);

        ep.ValidationFailed.Should().BeFalse();
        await _inviteConversationSeeder.Received(1).SeedForNewUserAsync(
            Arg.Is<ApplicationUser>(u => u.Email == "invited-client@example.com"), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_SeedThrows_StillConfirmsEmail_AndLogsWarning()
    {
        var userId = Guid.NewGuid();
        var user = CreateUser(userId, "seedfails@example.com");
        var clientProfile = new ClientProfile { Id = 1, UserId = userId };
        var token = new EmailVerificationToken
        {
            UserId = userId,
            User = user,
            Token = "seed-fail-token",
            ExpiresAt = DateTime.UtcNow.AddHours(1)
        };

        _inviteConversationSeeder
            .SeedForNewUserAsync(Arg.Any<ApplicationUser>(), Arg.Any<CancellationToken>())
            .Returns<Task>(_ => throw new InvalidOperationException("mongo down"));

        var db = new MockDbBuilder().With(user).With(clientProfile).With(token).Build();
        var ep = CreateEndpoint(db);

        // Act — the seed failure must not propagate. Verification is already committed.
        await ep.HandleAsync(new VerifyEmailRequest { Token = "seed-fail-token" }, TestContext.Current.CancellationToken);

        // Assert — verification still succeeds.
        ep.ValidationFailed.Should().BeFalse();
        user.EmailConfirmed.Should().BeTrue();

        // The failure is logged as an error, not swallowed silently.
        _logger.Received(1).Log(
            LogLevel.Error,
            Arg.Any<EventId>(),
            Arg.Is<object>(o => o.ToString()!.Contains("seedfails@example.com")),
            Arg.Is<Exception>(ex => ex is InvalidOperationException && ex.Message == "mongo down"),
            Arg.Any<Func<object, Exception?, string>>());
    }

    /// <summary>
    /// PendingInvite always represents an invitation of a client — a professional-only
    /// account (no ClientProfile) has no invite to match, so the seed must not run at all.
    /// </summary>
    [Fact]
    public async Task HandleAsync_ProfessionalOnlyAccount_DoesNotSeedPendingInviteConversations()
    {
        var userId = Guid.NewGuid();
        var user = CreateUser(userId, "coach-only@example.com");
        var token = new EmailVerificationToken
        {
            UserId = userId,
            User = user,
            Token = "coach-token",
            ExpiresAt = DateTime.UtcNow.AddHours(1)
        };

        // No ClientProfile for this user.
        var db = new MockDbBuilder().With(user).With(token).Build();
        var ep = CreateEndpoint(db);

        await ep.HandleAsync(new VerifyEmailRequest { Token = "coach-token" }, TestContext.Current.CancellationToken);

        ep.ValidationFailed.Should().BeFalse();
        await _inviteConversationSeeder.DidNotReceiveWithAnyArgs().SeedForNewUserAsync(
            default!, TestContext.Current.CancellationToken);
    }
}
