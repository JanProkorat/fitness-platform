using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Builders;
using FluentAssertions;
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
            TestContext.Current.CancellationToken);

        conversation.ProfessionalUserId.Should().Be(professionalId);
        conversation.ClientUserId.Should().Be(clientId);
        conversation.LastMessageText.Should().Be("Welcome aboard!");
        conversation.LastMessageSenderId.Should().Be(professionalId);

        db.Conversations.Received(1).Add(Arg.Any<Conversation>());
        db.ChatMessages.Received(1).Add(Arg.Is<ChatMessage>(m =>
            m.SenderUserId == professionalId && m.Text == "Welcome aboard!"));

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
            TestContext.Current.CancellationToken);

        conversation.ProfessionalUserId.Should().Be(professionalId);
        db.Conversations.Received(1).Add(Arg.Any<Conversation>());
        db.ChatMessages.DidNotReceive().Add(Arg.Any<ChatMessage>());
        await _notifier.DidNotReceiveWithAnyArgs().NotifyAsync(default, default!, default!, TestContext.Current.CancellationToken);
    }

    /// <summary>
    /// Idempotency guard (#768): if the conversation already exists — e.g. it was
    /// already seeded once at invite-creation time for an invitee who already had an
    /// account — a second call (from the accept-time flow) must NOT duplicate the
    /// message or re-broadcast "newmessage".
    /// </summary>
    [Fact]
    public async Task ExistingConversation_WithMessage_DoesNotDuplicateSeedMessage()
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
            TestContext.Current.CancellationToken);

        conversation.Should().BeSameAs(existingConversation);
        // Preview fields from the earlier seed must be untouched — no duplicate write.
        conversation.LastMessageText.Should().Be("Already delivered");

        db.Conversations.DidNotReceive().Add(Arg.Any<Conversation>());
        db.ChatMessages.DidNotReceive().Add(Arg.Any<ChatMessage>());
        await _notifier.DidNotReceiveWithAnyArgs().NotifyAsync(default, default!, default!, TestContext.Current.CancellationToken);
    }
}
