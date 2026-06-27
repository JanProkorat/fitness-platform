using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.Messaging;

/// <summary>
/// Integration tests for <c>GET /conversations/{conversationId}/messages</c>.
/// Covers the composite (DateCreated, Id) keyset pagination regression — messages
/// sharing the same DateCreated millisecond must never be dropped or duplicated
/// at a page boundary.
/// </summary>
[Collection(TestCollection.Name)]
public class GetMessagesEndpointTests(FitnessApiFactory factory)
{
    private static string UniqueEmail() => $"{Guid.NewGuid():N}@getmsg-test.com";
    private const string Password = "TestPass1!";

    // ── helpers ──────────────────────────────────────────────────────────────

    /// <summary>
    /// Registers a trainer and a client, starts a conversation between them,
    /// and returns their HTTP clients, tokens, and the conversation's PublicId.
    /// </summary>
    private async Task<(HttpClient TrainerHttp, HttpClient ClientHttp, Guid ConversationId)>
        SetupConversationAsync()
    {
        var ct = TestContext.Current.CancellationToken;

        // Trainer
        var trainerHttp = factory.CreateClient();
        var trainerEmail = UniqueEmail();
        await TestHelpers.RegisterAsync(trainerHttp, trainerEmail, Password, "Tina", "Trainer", "Trainer");
        var (trainerToken, _) = await TestHelpers.LoginAsync(trainerHttp, trainerEmail, Password);
        TestHelpers.SetBearerToken(trainerHttp, trainerToken);

        // Resolve trainer's ProfessionalProfile.PublicId (needed to start conversation)
        Guid profPublicId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var userId = (await db.Users.FirstAsync(u => u.Email == trainerEmail, ct)).Id;
            var profile = await db.ProfessionalProfiles.FirstAsync(p => p.UserId == userId, ct);
            profPublicId = profile.PublicId;
        }

        // Client
        var clientHttp = factory.CreateClient();
        var clientEmail = UniqueEmail();
        await TestHelpers.RegisterAsync(clientHttp, clientEmail, Password, "Carl", "Client", "Client");
        var (clientToken, _) = await TestHelpers.LoginAsync(clientHttp, clientEmail, Password);
        TestHelpers.SetBearerToken(clientHttp, clientToken);

        // Start conversation
        var convResp = await clientHttp.PostAsJsonAsync(
            "/conversations",
            new { ParticipantId = profPublicId },
            ct);
        convResp.EnsureSuccessStatusCode();
        var convBody = await convResp.Content.ReadFromJsonAsync<ConversationResponse>(cancellationToken: ct);
        var conversationId = convBody!.Id;

        return (trainerHttp, clientHttp, conversationId);
    }

    /// <summary>
    /// Seeds messages directly into the DB, bypassing the API so we can control
    /// DateCreated precisely to reproduce same-millisecond collisions.
    /// </summary>
    private async Task<List<Guid>> SeedMessagesAsync(
        Guid conversationId,
        Guid senderUserId,
        IEnumerable<DateTime> timestamps)
    {
        var ct = TestContext.Current.CancellationToken;
        var publicIds = new List<Guid>();

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var conv = await db.Conversations.FirstAsync(c => c.PublicId == conversationId, ct);

        foreach (var ts in timestamps)
        {
            var publicId = Guid.NewGuid();
            publicIds.Add(publicId);
            db.ChatMessages.Add(new ChatMessage
            {
                PublicId = publicId,
                ConversationId = conv.Id,
                SenderUserId = senderUserId,
                Text = $"msg at {ts:O}",
                IsRead = false,
                DateCreated = ts,
                DateUpdated = ts
            });
        }

        await db.SaveChangesAsync(ct);
        return publicIds;
    }

    // ── tests ─────────────────────────────────────────────────────────────────

    /// <summary>
    /// Core regression: two messages share the exact same DateCreated.
    /// With a page size of 1 the cursor falls exactly on the shared timestamp.
    /// Both messages must appear exactly once across the two pages — no drops,
    /// no duplicates.
    /// </summary>
    [Fact]
    public async Task GetMessages_TwoMessagesShareExactDateCreated_BothReturnedExactlyOnce()
    {
        var ct = TestContext.Current.CancellationToken;
        var (trainerHttp, clientHttp, conversationId) = await SetupConversationAsync();

        // Resolve client user id for seeding
        Guid clientUserId;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            // The client HTTP client already authenticated — pick the last registered user
            // whose email matches our conversation participant.  We resolve by conversation.
            var conv = await db.Conversations.FirstAsync(c => c.PublicId == conversationId, ct);
            clientUserId = conv.ClientUserId;
        }

        // Three messages: msg1 is newest, msg2 and msg3 share the SAME DateCreated (tie).
        // With limit=1, page 1 returns msg1, cursor = msg1.PublicId.
        // Page 2 must return msg2 (higher Id of the tie) without dropping msg3.
        // Page 3 must return msg3.
        var sharedTimestamp = new DateTime(2024, 1, 15, 10, 30, 0, DateTimeKind.Utc);
        var timestamps = new[]
        {
            sharedTimestamp.AddSeconds(5), // msg1 — most recent
            sharedTimestamp,              // msg2 — tie (inserted first → lower Id)
            sharedTimestamp               // msg3 — tie (inserted second → higher Id)
        };

        var seededIds = await SeedMessagesAsync(conversationId, clientUserId, timestamps);
        // seededIds[0] = msg1, seededIds[1] = msg2, seededIds[2] = msg3
        // After ThenByDescending(Id): page order = msg1, msg3, msg2

        // Page 1: limit=1, no cursor
        var page1Resp = await clientHttp.GetAsync(
            $"/conversations/{conversationId}/messages?limit=1",
            ct);
        page1Resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var page1 = await page1Resp.Content.ReadFromJsonAsync<MessagesResponse>(cancellationToken: ct);
        page1.Should().NotBeNull();
        page1!.Items.Should().HaveCount(1);

        var cursor1 = page1.Cursor;
        cursor1.Should().NotBeNull("a cursor must be returned when more messages may exist");

        // Page 2: limit=1, cursor=page1.Cursor
        var page2Resp = await clientHttp.GetAsync(
            $"/conversations/{conversationId}/messages?limit=1&cursor={cursor1}",
            ct);
        page2Resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var page2 = await page2Resp.Content.ReadFromJsonAsync<MessagesResponse>(cancellationToken: ct);
        page2.Should().NotBeNull();
        page2!.Items.Should().HaveCount(1, "the second tied message must not be dropped at the page boundary");

        var cursor2 = page2.Cursor;
        cursor2.Should().NotBeNull("a cursor must be returned while more messages remain");

        // Page 3: limit=1, cursor=page2.Cursor
        var page3Resp = await clientHttp.GetAsync(
            $"/conversations/{conversationId}/messages?limit=1&cursor={cursor2}",
            ct);
        page3Resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var page3 = await page3Resp.Content.ReadFromJsonAsync<MessagesResponse>(cancellationToken: ct);
        page3.Should().NotBeNull();
        page3!.Items.Should().HaveCount(1, "the third message must not be dropped");

        // Collect all returned PublicIds across all pages
        var allReturnedIds = page1.Items.Select(m => m.Id)
            .Concat(page2.Items.Select(m => m.Id))
            .Concat(page3.Items.Select(m => m.Id))
            .ToList();

        // Every seeded message must appear exactly once
        allReturnedIds.Should().HaveCount(seededIds.Count,
            "no message should be dropped or duplicated across pages");
        allReturnedIds.Should().OnlyHaveUniqueItems("no message should be returned on two pages");
        allReturnedIds.Should().BeEquivalentTo(seededIds,
            "every seeded message must appear exactly once across all pages");
    }

    /// <summary>
    /// Stale cursor (deleted message PublicId): pagination degrades gracefully —
    /// the endpoint treats the cursor as absent and returns from the beginning.
    /// </summary>
    [Fact]
    public async Task GetMessages_StaleCursorPublicId_DegradeGracefully()
    {
        var ct = TestContext.Current.CancellationToken;
        var (_, clientHttp, conversationId) = await SetupConversationAsync();

        var staleCursorId = Guid.NewGuid(); // does not correspond to any message

        var resp = await clientHttp.GetAsync(
            $"/conversations/{conversationId}/messages?limit=10&cursor={staleCursorId}",
            ct);

        // Should not throw — degrade to full list (no filter)
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    /// <summary>
    /// Non-participant gets 404 on the conversation — ownership check preserved.
    /// </summary>
    [Fact]
    public async Task GetMessages_NonParticipant_Returns404()
    {
        var ct = TestContext.Current.CancellationToken;
        var (_, _, conversationId) = await SetupConversationAsync();

        // Register a third user who is not part of the conversation
        var outsiderHttp = factory.CreateClient();
        var outsiderEmail = UniqueEmail();
        await TestHelpers.RegisterAsync(outsiderHttp, outsiderEmail, Password, "Oscar", "Outsider", "Client");
        var (outsiderToken, _) = await TestHelpers.LoginAsync(outsiderHttp, outsiderEmail, Password);
        TestHelpers.SetBearerToken(outsiderHttp, outsiderToken);

        var resp = await outsiderHttp.GetAsync(
            $"/conversations/{conversationId}/messages",
            ct);

        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    /// <summary>
    /// Unauthenticated request gets 401 — auth check preserved.
    /// </summary>
    [Fact]
    public async Task GetMessages_Unauthenticated_Returns401()
    {
        var ct = TestContext.Current.CancellationToken;
        var (_, _, conversationId) = await SetupConversationAsync();

        var anonHttp = factory.CreateClient();
        // No auth header

        var resp = await anonHttp.GetAsync(
            $"/conversations/{conversationId}/messages",
            ct);

        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── local response DTOs (per slice rules — no cross-feature imports) ──────

    private record MessageItemDto(Guid Id, Guid SenderId, string Text, DateTime Timestamp, bool IsRead);
    private record MessagesResponse(List<MessageItemDto> Items, Guid? Cursor);
    private record ConversationResponse(Guid Id);
}
