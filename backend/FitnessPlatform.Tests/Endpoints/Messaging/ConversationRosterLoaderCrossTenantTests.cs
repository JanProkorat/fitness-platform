using System.Net.Http.Json;
using System.Text.Json;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.Messaging;

/// <summary>
/// One client linked to two professionals: each professional's inbox row for that client must carry
/// only that professional's own conversation and check-in facts, never the other's. Covers the
/// link / conversation / check-in dimensions of <c>ConversationRosterLoader</c>; the plan dimension
/// is pinned by <c>PlanAuthorFilterIntegrationTests</c>.
/// </summary>
[Collection(TestCollection.Name)]
public class ConversationRosterLoaderCrossTenantTests(FitnessApiFactory factory)
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    [Fact]
    public async Task List_ClientLinkedToTwoProfessionals_EachRowCarriesOnlyThatProfessionalsData()
    {
        var professionalA = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var professionalB = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        await TestActors.Link(factory, professionalA, client).CreateAsync(TestContext.Current.CancellationToken);
        await TestActors.Link(factory, professionalB, client).CreateAsync(TestContext.Current.CancellationToken);

        // A: a read thread and an expired (missing) check-in.
        var conversationA = await SeedConversationAsync(professionalA.UserId, client.UserId, "from A", isRead: true);
        await SeedCheckInAsync(professionalA.UserId, client.UserId, WeeklyCheckInStatus.Expired, responded: false);

        // B: an unread thread and a responded-but-unreviewed check-in.
        var conversationB = await SeedConversationAsync(professionalB.UserId, client.UserId, "from B", isRead: false);
        await SeedCheckInAsync(professionalB.UserId, client.UserId, WeeklyCheckInStatus.Responded, responded: true);

        var rowA = await SingleRowAsync(professionalA, client, "All");
        rowA.Id.Should().Be(conversationA);
        rowA.LastMessage.Should().Be("from A");
        rowA.UnreadCount.Should().Be(0, "B's unread message is not A's");

        var rowB = await SingleRowAsync(professionalB, client, "All");
        rowB.Id.Should().Be(conversationB);
        rowB.LastMessage.Should().Be("from B");
        rowB.UnreadCount.Should().Be(1);

        (await ListAsync(professionalA, "UnreadMessages")).Should().NotContain(r => r.Participant.Id == client.UserId,
            "the unread message belongs to B's conversation");
        (await ListAsync(professionalA, "NewCheckIns")).Should().NotContain(r => r.Participant.Id == client.UserId,
            "the responded check-in belongs to B");
        (await ListAsync(professionalA, "MissingCheckIns")).Should().Contain(r => r.Participant.Id == client.UserId);

        (await ListAsync(professionalB, "UnreadMessages")).Should().Contain(r => r.Participant.Id == client.UserId);
        (await ListAsync(professionalB, "NewCheckIns")).Should().Contain(r => r.Participant.Id == client.UserId);
        (await ListAsync(professionalB, "MissingCheckIns")).Should().NotContain(r => r.Participant.Id == client.UserId,
            "the expired check-in belongs to A");
    }

    [Fact]
    public async Task List_ClientLinkedToTwoProfessionals_OtherProfessionalsThreadDoesNotLeakIntoPlaceholderRow()
    {
        var professionalA = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var professionalB = await TestActors.Trainer(factory).CreateAsync(TestContext.Current.CancellationToken);
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        await TestActors.Link(factory, professionalA, client).CreateAsync(TestContext.Current.CancellationToken);
        await TestActors.Link(factory, professionalB, client).CreateAsync(TestContext.Current.CancellationToken);

        await SeedConversationAsync(professionalB.UserId, client.UserId, "from B", isRead: false);

        var rowA = await SingleRowAsync(professionalA, client, "NoMessages");
        rowA.Id.Should().BeNull("A has no conversation with the client — B's thread must not appear");
        rowA.LastMessage.Should().BeEmpty();
        rowA.UnreadCount.Should().Be(0);
    }

    private async Task<Guid> SeedConversationAsync(Guid professionalUserId, Guid clientUserId, string text, bool isRead)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var conversation = new Conversation
        {
            PublicId = Guid.NewGuid(),
            ProfessionalUserId = professionalUserId,
            ClientUserId = clientUserId,
            LastMessageText = text,
            LastMessageAt = DateTime.UtcNow,
            LastMessageSenderId = clientUserId
        };
        db.Conversations.Add(conversation);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        db.ChatMessages.Add(new ChatMessage
        {
            PublicId = Guid.NewGuid(),
            ConversationId = conversation.Id,
            SenderUserId = clientUserId,
            Text = text,
            IsRead = isRead
        });
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        return conversation.PublicId;
    }

    private async Task SeedCheckInAsync(
        Guid professionalUserId, Guid clientUserId, WeeklyCheckInStatus status, bool responded)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        db.WeeklyCheckIns.Add(new WeeklyCheckIn
        {
            Id = Guid.NewGuid(),
            ClientUserId = clientUserId,
            ProfessionalUserId = professionalUserId,
            Profession = Profession.Training,
            WeekStartDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Status = status,
            SentAt = DateTime.UtcNow.AddDays(-7),
            DueAt = DateTime.UtcNow.AddDays(-1),
            RespondedAt = responded ? DateTime.UtcNow.AddDays(-2) : null,
            ReviewedByTrainerAt = null,
            DateCreated = DateTime.UtcNow,
            DateModified = DateTime.UtcNow
        });
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task<List<InboxRow>> ListAsync(Actor professional, string filter)
    {
        var response = await professional.Http.GetAsync(
            $"/conversations?filter={filter}", TestContext.Current.CancellationToken);
        response.EnsureSuccessStatusCode();

        return (await response.Content.ReadFromJsonAsync<List<InboxRow>>(
            JsonOptions, TestContext.Current.CancellationToken))!;
    }

    private async Task<InboxRow> SingleRowAsync(Actor professional, Actor client, string filter)
    {
        var rows = await ListAsync(professional, filter);
        return rows.Should().ContainSingle(r => r.Participant.Id == client.UserId).Subject;
    }

    private sealed class InboxRow
    {
        public Guid? Id { get; set; }
        public InboxParticipant Participant { get; set; } = null!;
        public string LastMessage { get; set; } = string.Empty;
        public int UnreadCount { get; set; }
    }

    private sealed class InboxParticipant
    {
        public Guid Id { get; set; }
    }
}
