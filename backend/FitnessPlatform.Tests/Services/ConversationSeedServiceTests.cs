using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Builders;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using MockQueryable.NSubstitute;
using Npgsql;
using NSubstitute;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Unit tests for <see cref="ConversationSeedService"/> — the shared
/// get-or-create-conversation + seed-first-message helper extracted for #768
/// (invite messages not surfacing as a chat conversation).
/// No Docker required — the Postgres DbSets are mocked.
/// </summary>
public class ConversationSeedServiceTests
{
    private readonly IRealtimeNotifier _notifier = Substitute.For<IRealtimeNotifier>();

    [Fact]
    public async Task NewConversation_WithMessage_CreatesConversationAndSeedsMessage()
    {
        var professionalId = Guid.NewGuid();
        var clientId = Guid.NewGuid();

        var db = new MockDbBuilder().Build();
        var service = new ConversationSeedService(db, _notifier);

        var conversation = await service.GetOrSeedConversationAsync(
            professionalId, clientId, professionalId, "Coach Carl", "Welcome aboard!",
            seedIntoExisting: false, TestContext.Current.CancellationToken);

        conversation.ProfessionalUserId.Should().Be(professionalId);
        conversation.ClientUserId.Should().Be(clientId);
        conversation.LastMessageText.Should().Be("Welcome aboard!");
        conversation.LastMessageSenderId.Should().Be(professionalId);

        db.Conversations.Received(1).Add(Arg.Any<Conversation>());
        // FIX 1 regression guard: the message must be built via the Conversation
        // navigation property (ConversationId is only assigned by EF on save), not
        // a pre-save ConversationId — and both inserts happen in a single save.
        db.ChatMessages.Received(1).Add(Arg.Is<ChatMessage>(m =>
            m.SenderUserId == professionalId && m.Text == "Welcome aboard!" && m.Conversation == conversation));
        await db.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());

        await _notifier.Received(1).NotifyAsync(
            clientId, "newmessage", Arg.Any<object>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task NewConversation_WithoutMessage_CreatesEmptyConversationShellOnly()
    {
        var professionalId = Guid.NewGuid();
        var clientId = Guid.NewGuid();

        var db = new MockDbBuilder().Build();
        var service = new ConversationSeedService(db, _notifier);

        var conversation = await service.GetOrSeedConversationAsync(
            professionalId, clientId, professionalId, "Coach Carl", null,
            seedIntoExisting: false, TestContext.Current.CancellationToken);

        conversation.ProfessionalUserId.Should().Be(professionalId);
        db.Conversations.Received(1).Add(Arg.Any<Conversation>());
        db.ChatMessages.DidNotReceive().Add(Arg.Any<ChatMessage>());
        await _notifier.DidNotReceiveWithAnyArgs().NotifyAsync(default, default!, default!, TestContext.Current.CancellationToken);
    }

    /// <summary>
    /// Idempotency guard for invite-ACCEPT callers (#768, seedIntoExisting: false):
    /// if the conversation already exists — e.g. it was already seeded once at
    /// invite-creation time for an invitee who already had an account — a second
    /// call from the accept-time flow must NOT duplicate the message or
    /// re-broadcast "newmessage".
    /// </summary>
    [Fact]
    public async Task ExistingConversation_SeedIntoExistingFalse_DoesNotDuplicateSeedMessage()
    {
        var professionalId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var existingConversation = new Conversation
        {
            ProfessionalUserId = professionalId,
            ClientUserId = clientId,
            LastMessageText = "Already delivered",
        };

        var db = new MockDbBuilder().With(existingConversation).Build();
        var service = new ConversationSeedService(db, _notifier);

        var conversation = await service.GetOrSeedConversationAsync(
            professionalId, clientId, professionalId, "Coach Carl", "Welcome aboard!",
            seedIntoExisting: false, TestContext.Current.CancellationToken);

        conversation.Should().BeSameAs(existingConversation);
        // Preview fields from the earlier seed must be untouched — no duplicate write.
        conversation.LastMessageText.Should().Be("Already delivered");

        db.Conversations.DidNotReceive().Add(Arg.Any<Conversation>());
        db.ChatMessages.DidNotReceive().Add(Arg.Any<ChatMessage>());
        await db.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
        await _notifier.DidNotReceiveWithAnyArgs().NotifyAsync(default, default!, default!, TestContext.Current.CancellationToken);
    }

    /// <summary>
    /// FIX 3 (#768 review) — invite-CREATION callers (seedIntoExisting: true) must
    /// restore the pre-extraction behavior: append the message even when the two
    /// participants already have a conversation, so re-inviting an already-conversing
    /// contact with a personal message still delivers it instead of silently dropping it.
    /// </summary>
    [Fact]
    public async Task ExistingConversation_SeedIntoExistingTrue_AppendsMessage()
    {
        var professionalId = Guid.NewGuid();
        var clientId = Guid.NewGuid();
        var existingConversation = new Conversation
        {
            ProfessionalUserId = professionalId,
            ClientUserId = clientId,
            LastMessageText = "Earlier chat",
        };

        var db = new MockDbBuilder().With(existingConversation).Build();
        var service = new ConversationSeedService(db, _notifier);

        var conversation = await service.GetOrSeedConversationAsync(
            professionalId, clientId, professionalId, "Coach Carl", "Great to reconnect!",
            seedIntoExisting: true, TestContext.Current.CancellationToken);

        conversation.Should().BeSameAs(existingConversation);
        conversation.LastMessageText.Should().Be("Great to reconnect!");

        db.Conversations.DidNotReceive().Add(Arg.Any<Conversation>());
        db.ChatMessages.Received(1).Add(Arg.Is<ChatMessage>(m =>
            m.SenderUserId == professionalId && m.Text == "Great to reconnect!" && m.Conversation == existingConversation));
        await db.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
        await _notifier.Received(1).NotifyAsync(
            clientId, "newmessage", Arg.Any<object>(), Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// FIX 2 (#768 review) — a concurrent double-accept/double-invite race can make
    /// two requests both observe "no conversation yet" and both attempt the insert.
    /// The unique index on (ProfessionalUserId, ClientUserId) lets only one win; the
    /// loser must catch the resulting DbUpdateException/unique-violation, re-query the
    /// winner's row, and return it as a no-op — never an unhandled 500.
    /// </summary>
    [Fact]
    public async Task ConcurrentInsert_UniqueViolation_ReQueriesWinnerInsteadOfThrowing()
    {
        var professionalId = Guid.NewGuid();
        var clientId = Guid.NewGuid();

        // Build mock DbSets BEFORE configuring Returns (see MockDbBuilder's note on
        // NSubstitute's "substitute inside Returns()" pitfall — BuildMockDbSet()
        // itself creates a substitute, which resets NSubstitute's "last call" context
        // if invoked inline as a Returns() argument).
        var conversationsList = new List<Conversation>();
        var conversationsSet = conversationsList.BuildMockDbSet();
        var chatMessagesSet = new List<ChatMessage>().BuildMockDbSet();

        var db = Substitute.For<IApplicationDbContext>();
        db.Conversations.Returns(conversationsSet);
        db.ChatMessages.Returns(chatMessagesSet);

        db.SaveChangesAsync(Arg.Any<CancellationToken>()).Returns<int>(_ =>
        {
            // Simulate the concurrent winner's transaction committing its row first,
            // then this request's own INSERT hitting the unique-index conflict.
            conversationsList.Add(new Conversation
            {
                ProfessionalUserId = professionalId,
                ClientUserId = clientId,
                LastMessageText = "Concurrent winner's message",
            });

            var pgEx = new PostgresException("duplicate key value violates unique constraint", "ERROR", "ERROR", "23505");
            throw new DbUpdateException("conflict", pgEx);
        });

        var service = new ConversationSeedService(db, _notifier);

        var conversation = await service.GetOrSeedConversationAsync(
            professionalId, clientId, professionalId, "Coach Carl", "Welcome aboard!",
            seedIntoExisting: false, TestContext.Current.CancellationToken);

        // No exception propagated — the loser resolves to the winner's row.
        conversation.LastMessageText.Should().Be("Concurrent winner's message");
        await _notifier.DidNotReceiveWithAnyArgs().NotifyAsync(default, default!, default!, TestContext.Current.CancellationToken);
    }
}
