using System.Net;
using System.Net.Http.Json;
using System.Text;
using FluentAssertions;
using FitnessPlatform.Tests.Infrastructure;

namespace FitnessPlatform.Tests.Endpoints.Client.Invites;

/// <summary>
/// End-to-end (real Postgres via Testcontainers) coverage for the account-creation-time
/// conversation seed introduced by #803/#817: a prospective client invited before they have
/// an account must see the coach's opening message in Messages as soon as they register —
/// not only after they accept the invite.
/// </summary>
/// <remarks>
/// Root cause: <c>Conversation</c> is keyed on (ProfessionalUserId, ClientUserId) — both real
/// ApplicationUser ids — so it cannot be seeded at invite-creation time for a prospective
/// client with no account yet. <c>PendingInviteConversationSeeder</c> closes the gap at the
/// earliest possible seam (account creation), called from RegisterEndpoint /
/// GoogleSocialLoginEndpoint / AppleSocialLoginEndpoint.
/// </remarks>
[Collection(TestCollection.Name)]
public class PendingInviteConversationSeedingIntegrationTests(FitnessApiFactory factory)
{
    private static string UniqueEmail(string prefix) => $"{prefix}-{Guid.NewGuid():N}@test.com";

    /// <summary>
    /// Registers a trainer, logs in, and creates a pending invite for <paramref name="clientEmail"/>
    /// with the given message (or none). Returns the created invite's PublicId.
    /// </summary>
    private async Task<Guid> CreateTrainerInviteAsync(HttpClient trainerClient, string clientEmail, string? message)
    {
        var trainerEmail = UniqueEmail("trainer");
        await TestHelpers.RegisterAsync(trainerClient, trainerEmail, "TestPass1!", "Coach", "Carl", "Trainer");
        var (trainerAccessToken, _) = await TestHelpers.LoginAsync(trainerClient, trainerEmail, "TestPass1!");
        TestHelpers.SetBearerToken(trainerClient, trainerAccessToken);

        var inviteResponse = await trainerClient.PostAsJsonAsync("/trainer/pending-invites", new
        {
            FirstName = "Prospective",
            LastName = "Client",
            Email = clientEmail,
            Message = message
        }, cancellationToken: TestContext.Current.CancellationToken);

        inviteResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var invite = await inviteResponse.Content.ReadFromJsonAsync<CreatePendingInviteResult>(
            cancellationToken: TestContext.Current.CancellationToken);
        return invite!.PublicId;
    }

    [Fact]
    public async Task Register_WithMessageBearingPendingInvite_ConversationVisibleBeforeAccept()
    {
        var trainerClient = factory.CreateClient();
        var clientEmail = UniqueEmail("client");

        await CreateTrainerInviteAsync(trainerClient, clientEmail, "Welcome aboard, let's get started!");

        // Register the invited client — this is the seam under test: the invite carried no
        // account at creation time, so the conversation could not be seeded until now.
        var clientClient = factory.CreateClient();
        var registerResponse = await TestHelpers.RegisterAsync(
            clientClient, clientEmail, "TestPass1!", "Prospective", "Client", "Client");
        registerResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var (clientAccessToken, _) = await TestHelpers.LoginAsync(clientClient, clientEmail, "TestPass1!");
        TestHelpers.SetBearerToken(clientClient, clientAccessToken);

        // The conversation — and the coach's opening message — must already be visible,
        // BEFORE the client has accepted or declined the invite.
        var conversationsResponse = await clientClient.GetAsync("/conversations", TestContext.Current.CancellationToken);
        conversationsResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var conversations = await conversationsResponse.Content.ReadFromJsonAsync<List<ConversationResult>>(
            cancellationToken: TestContext.Current.CancellationToken);

        conversations.Should().ContainSingle();
        conversations![0].LastMessage.Should().Be("Welcome aboard, let's get started!");
        conversations[0].Participant.Name.Should().Be("Coach Carl");
    }

    [Fact]
    public async Task Register_WithMessagelessPendingInvite_DoesNotCreateEmptyConversationShell()
    {
        var trainerClient = factory.CreateClient();
        var clientEmail = UniqueEmail("client-nomsg");

        // Invite carries no message at all.
        await CreateTrainerInviteAsync(trainerClient, clientEmail, message: null);

        var clientClient = factory.CreateClient();
        var registerResponse = await TestHelpers.RegisterAsync(
            clientClient, clientEmail, "TestPass1!", "Prospective", "Client", "Client");
        registerResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var (clientAccessToken, _) = await TestHelpers.LoginAsync(clientClient, clientEmail, "TestPass1!");
        TestHelpers.SetBearerToken(clientClient, clientAccessToken);

        var conversationsResponse = await clientClient.GetAsync("/conversations", TestContext.Current.CancellationToken);
        conversationsResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var conversations = await conversationsResponse.Content.ReadFromJsonAsync<List<ConversationResult>>(
            cancellationToken: TestContext.Current.CancellationToken);

        // No empty conversation shell — the message-less invite must not surface any
        // conversation until the client actually accepts (which still creates the
        // client-professional link, but a conversation shell without a message is
        // never desirable clutter in Messages).
        conversations.Should().BeEmpty();
    }

    [Fact]
    public async Task Accept_AfterRegisterEarlySeed_IsIdempotent_NoDuplicateMessage()
    {
        var trainerClient = factory.CreateClient();
        var clientEmail = UniqueEmail("client-idem");

        await CreateTrainerInviteAsync(trainerClient, clientEmail, "Looking forward to working with you!");

        var clientClient = factory.CreateClient();
        await TestHelpers.RegisterAsync(clientClient, clientEmail, "TestPass1!", "Prospective", "Client", "Client");
        var (clientAccessToken, _) = await TestHelpers.LoginAsync(clientClient, clientEmail, "TestPass1!");
        TestHelpers.SetBearerToken(clientClient, clientAccessToken);

        // Sanity: the conversation was already seeded at register time.
        var conversationsBeforeAccept = await (await clientClient.GetAsync(
                "/conversations", TestContext.Current.CancellationToken))
            .Content.ReadFromJsonAsync<List<ConversationResult>>(cancellationToken: TestContext.Current.CancellationToken);
        conversationsBeforeAccept.Should().ContainSingle();
        var conversationId = conversationsBeforeAccept![0].Id;

        // Find + accept the pending invite.
        var pendingResponse = await clientClient.GetAsync("/client/invites/pending", TestContext.Current.CancellationToken);
        pendingResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var pending = await pendingResponse.Content.ReadFromJsonAsync<PendingInviteResult>(
            cancellationToken: TestContext.Current.CancellationToken);

        var acceptResponse = await clientClient.PostAsync(
            $"/client/invites/{pending!.Id}/accept",
            new StringContent("{}", Encoding.UTF8, "application/json"),
            TestContext.Current.CancellationToken);
        acceptResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // The accept-time seed call is a no-op once the conversation already exists (#768
        // seedIntoExisting: false contract) — no duplicate message, still one conversation.
        var conversationsAfterAccept = await (await clientClient.GetAsync(
                "/conversations", TestContext.Current.CancellationToken))
            .Content.ReadFromJsonAsync<List<ConversationResult>>(cancellationToken: TestContext.Current.CancellationToken);
        conversationsAfterAccept.Should().ContainSingle();

        var messagesResponse = await clientClient.GetAsync(
            $"/conversations/{conversationId}/messages", TestContext.Current.CancellationToken);
        messagesResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var messages = await messagesResponse.Content.ReadFromJsonAsync<GetMessagesResult>(
            cancellationToken: TestContext.Current.CancellationToken);

        messages!.Items.Should().ContainSingle(
            "the invite message must be delivered exactly once, not duplicated by the later accept");
    }

    [Fact]
    public async Task Decline_AfterRegisterEarlySeedAndMessageExchange_PreservesConversationHistory()
    {
        var trainerClient = factory.CreateClient();
        var clientEmail = UniqueEmail("client-decline");

        await CreateTrainerInviteAsync(trainerClient, clientEmail, "Hope to hear from you soon.");

        var clientClient = factory.CreateClient();
        await TestHelpers.RegisterAsync(clientClient, clientEmail, "TestPass1!", "Prospective", "Client", "Client");
        var (clientAccessToken, _) = await TestHelpers.LoginAsync(clientClient, clientEmail, "TestPass1!");
        TestHelpers.SetBearerToken(clientClient, clientAccessToken);

        var conversationsBeforeDecline = await (await clientClient.GetAsync(
                "/conversations", TestContext.Current.CancellationToken))
            .Content.ReadFromJsonAsync<List<ConversationResult>>(cancellationToken: TestContext.Current.CancellationToken);
        conversationsBeforeDecline.Should().ContainSingle();
        var conversationId = conversationsBeforeDecline![0].Id;

        // The client exchanges a message with the coach WHILE the invite is still pending —
        // this is the #803 "chat before deciding" behavior.
        var sendResponse = await clientClient.PostAsJsonAsync(
            $"/conversations/{conversationId}/messages",
            new { ConversationId = conversationId, Text = "Thanks, I have a question before I decide." },
            cancellationToken: TestContext.Current.CancellationToken);
        sendResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Now the client declines the invite.
        var pendingResponse = await clientClient.GetAsync("/client/invites/pending", TestContext.Current.CancellationToken);
        var pending = await pendingResponse.Content.ReadFromJsonAsync<PendingInviteResult>(
            cancellationToken: TestContext.Current.CancellationToken);

        var declineResponse = await clientClient.PostAsync(
            $"/client/invites/{pending!.Id}/decline",
            new StringContent("{}", Encoding.UTF8, "application/json"),
            TestContext.Current.CancellationToken);
        declineResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Decline must never touch conversations — the seeded opening message AND the
        // client's own reply must both survive.
        var conversationsAfterDecline = await (await clientClient.GetAsync(
                "/conversations", TestContext.Current.CancellationToken))
            .Content.ReadFromJsonAsync<List<ConversationResult>>(cancellationToken: TestContext.Current.CancellationToken);
        conversationsAfterDecline.Should().ContainSingle();
        conversationsAfterDecline![0].LastMessage.Should().Be("Thanks, I have a question before I decide.");

        var messagesResponse = await clientClient.GetAsync(
            $"/conversations/{conversationId}/messages", TestContext.Current.CancellationToken);
        var messages = await messagesResponse.Content.ReadFromJsonAsync<GetMessagesResult>(
            cancellationToken: TestContext.Current.CancellationToken);

        messages!.Items.Should().HaveCount(2, "both the coach's opening message and the client's reply must survive a decline");
    }

    private record CreatePendingInviteResult(Guid PublicId);
    private record PendingInviteResult(string Id);
    private record ConversationResult(Guid Id, ParticipantResult Participant, string LastMessage);
    private record ParticipantResult(Guid Id, string Name);
    private record GetMessagesResult(List<MessageResult> Items, Guid? Cursor);
    private record MessageResult(Guid Id, Guid SenderId, string Text, DateTime Timestamp, bool IsRead);
}
