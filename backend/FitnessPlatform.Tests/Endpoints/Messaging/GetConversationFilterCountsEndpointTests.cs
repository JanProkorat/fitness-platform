using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.Messaging;

/// <summary>
/// Integration tests for <c>GET /conversations/filter-counts</c> (#1095) — the inbox dropdown's
/// chip counts, computed by the same <c>ConversationRosterLoader</c> +
/// <c>ClientRosterFilterClassifier</c> pipeline <c>GetConversationsEndpoint</c>'s <c>filter</c>
/// param uses.
/// </summary>
[Collection(TestCollection.Name)]
public class GetConversationFilterCountsEndpointTests(FitnessApiFactory factory)
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };
    private static string UniqueEmail(string tag) => $"{Guid.NewGuid():N}@conv-filter-counts-{tag}.com";
    private const string Password = "TestPass1!";

    [Fact]
    public async Task GetCounts_NoLinkedClients_AllZero()
    {
        var (http, _) = await SetupTrainerAsync();

        var response = await http.GetAsync("/conversations/filter-counts", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await Deserialize(response);

        body!.All.Should().Be(0);
        body.UnreadMessages.Should().Be(0);
        body.NoMessages.Should().Be(0);
        body.NewCheckIns.Should().Be(0);
        body.MissingCheckIns.Should().Be(0);
        body.EndingSoon.Should().Be(0);
    }

    [Fact]
    public async Task GetCounts_MixedRoster_MatchesGetConversationsFilterMembership()
    {
        var (http, trainerId) = await SetupTrainerAsync();
        var (unreadClientId, _) = await SetupLinkedClientAsync(trainerId);
        var (noMessagesClientId, _) = await SetupLinkedClientAsync(trainerId);
        _ = noMessagesClientId; // no conversation seeded — counts toward NoMessages by construction

        await SeedConversationWithMessageAsync(trainerId, unreadClientId, senderIsClient: true, isRead: false);

        var response = await http.GetAsync("/conversations/filter-counts", TestContext.Current.CancellationToken);
        var body = await Deserialize(response);

        body!.All.Should().Be(2);
        body.UnreadMessages.Should().Be(1);
        body.NoMessages.Should().Be(1);
    }

    [Fact]
    public async Task GetCounts_ArchivedConversation_StillCountsTowardUnreadMessages()
    {
        // Counts are independent of the archived display toggle — this endpoint has no
        // `archived` param at all, so an archived-but-unread conversation still counts.
        var (http, trainerId) = await SetupTrainerAsync();
        var (clientId, _) = await SetupLinkedClientAsync(trainerId);
        var conversationId = await SeedConversationWithMessageAsync(
            trainerId, clientId, senderIsClient: true, isRead: false);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var conversation = await db.Conversations
                .FirstAsync(c => c.PublicId == conversationId, TestContext.Current.CancellationToken);
            conversation.ArchivedByProfessionalAt = DateTime.UtcNow;
            await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var response = await http.GetAsync("/conversations/filter-counts", TestContext.Current.CancellationToken);
        var body = await Deserialize(response);

        body!.UnreadMessages.Should().Be(1);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private async Task<(HttpClient Http, Guid UserId)> SetupTrainerAsync()
    {
        var http = factory.CreateClient();
        var email = UniqueEmail("trainer");

        await TestHelpers.RegisterAsync(http, email, Password, "Test", "Trainer", "Trainer");
        var (token, _) = await TestHelpers.LoginAsync(http, email, Password);
        TestHelpers.SetBearerToken(http, token);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var user = await db.Users.AsNoTracking()
            .FirstAsync(u => u.Email == email, TestContext.Current.CancellationToken);

        return (http, user.Id);
    }

    private async Task<(Guid ClientUserId, Guid ClientPublicId)> SetupLinkedClientAsync(Guid professionalUserId)
    {
        var clientUserId = await TestHelpers.RegisterLinkedClientAsync(
            factory, professionalUserId, TestContext.Current.CancellationToken);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var clientProfile = await db.ClientProfiles.AsNoTracking()
            .FirstAsync(cp => cp.UserId == clientUserId, TestContext.Current.CancellationToken);

        return (clientUserId, clientProfile.PublicId);
    }

    private async Task<Guid> SeedConversationWithMessageAsync(
        Guid professionalUserId, Guid clientUserId, bool senderIsClient, bool isRead)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var conversation = new Conversation
        {
            PublicId = Guid.NewGuid(),
            ProfessionalUserId = professionalUserId,
            ClientUserId = clientUserId
        };
        db.Conversations.Add(conversation);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        db.ChatMessages.Add(new ChatMessage
        {
            PublicId = Guid.NewGuid(),
            ConversationId = conversation.Id,
            SenderUserId = senderIsClient ? clientUserId : professionalUserId,
            Text = "hello",
            IsRead = isRead
        });
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);

        return conversation.PublicId;
    }

    private static async Task<CountsDto?> Deserialize(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<CountsDto>(JsonOptions, TestContext.Current.CancellationToken);

    // ── Local response DTO (per slice rules — no cross-feature imports) ──────

    private sealed class CountsDto
    {
        public int All { get; set; }
        public int UnreadMessages { get; set; }
        public int NoMessages { get; set; }
        public int NewCheckIns { get; set; }
        public int MissingCheckIns { get; set; }
        public int EndingSoon { get; set; }
    }
}
