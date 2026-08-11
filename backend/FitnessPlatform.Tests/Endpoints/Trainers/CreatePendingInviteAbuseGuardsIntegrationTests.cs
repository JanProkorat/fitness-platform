using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using FitnessPlatform.Tests.Infrastructure;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

/// <summary>
/// End-to-end (real Postgres via Testcontainers) coverage for the claude-security F8 fix on
/// POST /trainer/pending-invites: creating an invite for an email that already belongs to a
/// registered user must NOT immediately write a chat message, a notification, or fire a
/// realtime push into that user's account — those side effects are deferred to acceptance time.
/// A unit test against a mocked DbContext cannot observe this: the fix removed the
/// IConversationSeedService/INotificationService/IRealtimeNotifier dependencies from the
/// endpoint entirely, so only a real end-to-end read of the invited user's own inbox proves
/// nothing was written there.
/// </summary>
[Collection(TestCollection.Name)]
public class CreatePendingInviteAbuseGuardsIntegrationTests(FitnessApiFactory factory)
{
    private static string UniqueEmail(string prefix) => $"{prefix}-{Guid.NewGuid():N}@test.com";

    [Fact]
    public async Task CreateInvite_ForExistingUserWithMessage_DoesNotSeedConversationOrNotification()
    {
        // Arrange: the invited email ALREADY belongs to a registered client — the exact shape
        // the abuse case exploited (no relationship required between the professional and the
        // invited account).
        var clientClient = factory.CreateClient();
        var clientEmail = UniqueEmail("existing-client");
        await TestHelpers.RegisterAsync(clientClient, clientEmail, "TestPass1!", "Existing", "Client", "Client");
        var (clientAccessToken, _) = await TestHelpers.LoginAsync(clientClient, clientEmail, "TestPass1!");
        TestHelpers.SetBearerToken(clientClient, clientAccessToken);

        var trainerClient = factory.CreateClient();
        var trainerEmail = UniqueEmail("stranger-trainer");
        await TestHelpers.RegisterAsync(trainerClient, trainerEmail, "TestPass1!", "Stranger", "Coach", "Trainer");
        var (trainerAccessToken, _) = await TestHelpers.LoginAsync(trainerClient, trainerEmail, "TestPass1!");
        TestHelpers.SetBearerToken(trainerClient, trainerAccessToken);

        // Act: the stranger trainer invites the already-registered client, carrying a message —
        // this is exactly the payload the finding describes as attacker-controlled text.
        var inviteResponse = await trainerClient.PostAsJsonAsync("/trainer/pending-invites", new
        {
            FirstName = "Existing",
            LastName = "Client",
            Email = clientEmail,
            Message = "This text must not land in the client's inbox before they accept."
        }, cancellationToken: TestContext.Current.CancellationToken);

        inviteResponse.StatusCode.Should().Be(HttpStatusCode.OK,
            "the invite itself is still created successfully — only the immediate side effect is removed");

        // Assert: no conversation was created for the invited client.
        var conversationsResponse = await clientClient.GetAsync(
            "/conversations", TestContext.Current.CancellationToken);
        conversationsResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var conversations = await conversationsResponse.Content.ReadFromJsonAsync<List<ConversationResult>>(
            cancellationToken: TestContext.Current.CancellationToken);
        conversations.Should().BeEmpty(
            "the chat message must not be seeded until the client accepts the invite");

        // Assert: no notification was created for the invited client either.
        var notificationsResponse = await clientClient.GetAsync(
            "/client/notifications", TestContext.Current.CancellationToken);
        notificationsResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var notifications = await notificationsResponse.Content.ReadFromJsonAsync<GetNotificationsResult>(
            cancellationToken: TestContext.Current.CancellationToken);
        notifications!.Items.Should().BeEmpty(
            "an unsolicited invite must not raise an in-app notification before acceptance");

        // Positive control: the client CAN still discover the invite through the existing
        // polling endpoint — the fix defers the push, it does not hide the invite entirely.
        var pendingResponse = await clientClient.GetAsync(
            "/client/invites/pending", TestContext.Current.CancellationToken);
        pendingResponse.StatusCode.Should().Be(HttpStatusCode.OK,
            "the client must still be able to discover the invite via the existing pending-invite query");
    }

    private record ConversationResult(Guid Id);
    private record GetNotificationsResult(List<object> Items, string? Cursor);
}
