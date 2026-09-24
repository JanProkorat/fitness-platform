using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Builders;
using FluentAssertions;
using NSubstitute;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Unit tests for <see cref="PendingInviteConversationSeeder"/> — the email-verification-time
/// seam (moved from RegisterEndpoint to VerifyEmailEndpoint for #1100, R4) that seeds an
/// Invited cooperation event (plus the invite's message, if any) for every non-accepted
/// PendingInvite addressed to the just-verified email. <see cref="IConversationSeedService"/>
/// is substituted so these tests verify only the "which invites qualify, and with what
/// arguments" lookup logic; the actual get-or-create-conversation + event/message write
/// behavior is covered by
/// <see cref="FitnessPlatform.Tests.Services.ConversationSeedServiceTests"/>. No Docker
/// required — the Postgres DbSets are mocked.
/// </summary>
public class PendingInviteConversationSeederTests
{
    private readonly IConversationSeedService _conversationSeedService = Substitute.For<IConversationSeedService>();

    private static ApplicationUser NewUser(string email) => new()
    {
        Id = Guid.NewGuid(),
        Email = email,
        NormalizedEmail = email.ToUpperInvariant(),
        FirstName = "New",
        LastName = "Client"
    };

    private static ProfessionalProfile MakeProfessional(string firstName, string lastName)
    {
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            Email = $"{firstName}.{lastName}@coach.example.com",
            FirstName = firstName,
            LastName = lastName
        };
        return new ProfessionalProfile { Id = Random.Shared.Next(1, int.MaxValue), UserId = user.Id, User = user };
    }

    [Fact]
    public async Task SeedForNewUserAsync_MatchingInviteWithMessage_AppendsInvitedEventWithMessage()
    {
        var newUser = NewUser("client@example.com");
        var professional = MakeProfessional("Coach", "Carl");
        var invite = new PendingInvite
        {
            ProfessionalProfileId = professional.Id,
            ProfessionalProfile = professional,
            // Different casing than the new user's NormalizedEmail — must still match
            // (same UPPER()-on-both-sides idiom as GetPendingInviteEndpoint / Accept /
            // DeclineClientInviteEndpoint).
            Email = "Client@Example.com",
            Message = "Welcome aboard!",
            IsAccepted = false
        };

        var db = new MockDbBuilder().With(invite).Build();
        var seeder = new PendingInviteConversationSeeder(db, _conversationSeedService);

        await seeder.SeedForNewUserAsync(newUser, TestContext.Current.CancellationToken);

        await _conversationSeedService.Received(1).AppendCooperationEventAsync(
            professional.UserId, newUser.Id, professional.UserId,
            ChatEventType.Invited, invite.PublicId, "Welcome aboard!",
            createConversationIfMissing: true, TestContext.Current.CancellationToken);
    }

    /// <summary>
    /// R4 + the maintainer's message-less=yes ruling: a message-less invite still seeds a
    /// thread now — the banner alone — unlike the pre-#1100 seeder, which skipped it
    /// entirely to avoid an empty conversation shell.
    /// </summary>
    [Fact]
    public async Task SeedForNewUserAsync_MatchingInviteWithoutMessage_StillAppendsInvitedEvent()
    {
        var newUser = NewUser("nomessage@example.com");
        var professional = MakeProfessional("Coach", "Carl");
        var invite = new PendingInvite
        {
            ProfessionalProfileId = professional.Id,
            ProfessionalProfile = professional,
            Email = "nomessage@example.com",
            Message = null,
            IsAccepted = false
        };

        var db = new MockDbBuilder().With(invite).Build();
        var seeder = new PendingInviteConversationSeeder(db, _conversationSeedService);

        await seeder.SeedForNewUserAsync(newUser, TestContext.Current.CancellationToken);

        await _conversationSeedService.Received(1).AppendCooperationEventAsync(
            professional.UserId, newUser.Id, professional.UserId,
            ChatEventType.Invited, invite.PublicId, null,
            createConversationIfMissing: true, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task SeedForNewUserAsync_MultiplePendingInvites_AppendsOneEventPerQualifyingInvite()
    {
        var newUser = NewUser("multi@example.com");
        var coach1 = MakeProfessional("Coach", "One");
        var coach2 = MakeProfessional("Coach", "Two");

        var invite1 = new PendingInvite
        {
            ProfessionalProfileId = coach1.Id,
            ProfessionalProfile = coach1,
            Email = "multi@example.com",
            Message = "Hi from coach one",
            IsAccepted = false
        };
        var invite2 = new PendingInvite
        {
            ProfessionalProfileId = coach2.Id,
            ProfessionalProfile = coach2,
            Email = "multi@example.com",
            Message = "Hi from coach two",
            IsAccepted = false
        };

        var db = new MockDbBuilder().With(invite1).With(invite2).Build();
        var seeder = new PendingInviteConversationSeeder(db, _conversationSeedService);

        await seeder.SeedForNewUserAsync(newUser, TestContext.Current.CancellationToken);

        await _conversationSeedService.Received(1).AppendCooperationEventAsync(
            coach1.UserId, newUser.Id, coach1.UserId,
            ChatEventType.Invited, invite1.PublicId, "Hi from coach one",
            createConversationIfMissing: true, TestContext.Current.CancellationToken);
        await _conversationSeedService.Received(1).AppendCooperationEventAsync(
            coach2.UserId, newUser.Id, coach2.UserId,
            ChatEventType.Invited, invite2.PublicId, "Hi from coach two",
            createConversationIfMissing: true, TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task SeedForNewUserAsync_NoMatchingInvite_NoOp()
    {
        var newUser = NewUser("nomatch@example.com");

        var db = new MockDbBuilder().Build();
        var seeder = new PendingInviteConversationSeeder(db, _conversationSeedService);

        await seeder.SeedForNewUserAsync(newUser, TestContext.Current.CancellationToken);

        await _conversationSeedService.DidNotReceiveWithAnyArgs().AppendCooperationEventAsync(
            default, default, default, default, default, default, default, TestContext.Current.CancellationToken);
    }

    /// <summary>
    /// An already-accepted invite must never be re-seeded from this helper — it either was
    /// already seeded earlier (at invite-creation time, or by an earlier verification) or
    /// belongs to a fully-consumed relationship. The lookup filters on <c>!IsAccepted</c>.
    /// </summary>
    [Fact]
    public async Task SeedForNewUserAsync_AlreadyAcceptedInvite_IsSkipped()
    {
        var newUser = NewUser("accepted@example.com");
        var professional = MakeProfessional("Coach", "Carl");
        var invite = new PendingInvite
        {
            ProfessionalProfileId = professional.Id,
            ProfessionalProfile = professional,
            Email = "accepted@example.com",
            Message = "Already accepted invite",
            IsAccepted = true
        };

        var db = new MockDbBuilder().With(invite).Build();
        var seeder = new PendingInviteConversationSeeder(db, _conversationSeedService);

        await seeder.SeedForNewUserAsync(newUser, TestContext.Current.CancellationToken);

        await _conversationSeedService.DidNotReceiveWithAnyArgs().AppendCooperationEventAsync(
            default, default, default, default, default, default, default, TestContext.Current.CancellationToken);
    }
}
