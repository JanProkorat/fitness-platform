using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Infrastructure.Data;
using FormUp.Tests.Builders;
using FormUp.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FormUp.Tests.Endpoints.Messaging;

/// <summary>
/// The new-message in-app notice from POST /conversations/{id}/messages: only the coach gets one.
/// </summary>
[Collection(TestCollection.Name)]
public class SendMessageNotificationTests(FitnessApiFactory factory)
{
    private async Task<(Actor Coach, Actor Client, Guid ConversationId)> SeedConversationAsync()
    {
        var ct = TestContext.Current.CancellationToken;
        var coach = await TestActors.Trainer(factory).CreateAsync(ct);
        var client = await TestActors.Client(factory).WithName("Petra", "Svobodova").CreateAsync(ct);
        await TestActors.Link(factory, coach, client).CreateAsync(ct);

        var created = await client.Http.PostAsJsonAsync("/conversations", new { ParticipantId = coach.PublicId }, ct);
        created.EnsureSuccessStatusCode();
        var conversation = await created.Content.ReadFromJsonAsync<ConversationResponse>(cancellationToken: ct);

        return (coach, client, conversation!.Id);
    }

    private sealed record ConversationResponse(Guid Id);

    private async Task<int> NewMessageNoticeCountAsync(Guid recipientUserId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        return await db.Notifications.CountAsync(
            n => n.RecipientUserId == recipientUserId && n.Type == NotificationType.NewMessage,
            TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Send_ClientWritesToCoach_CreatesOneNoticeForTheCoach()
    {
        var (coach, client, conversationId) = await SeedConversationAsync();

        var response = await client.Http.PostAsJsonAsync(
            $"/conversations/{conversationId}/messages", new { Text = "Hello coach" }, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await NewMessageNoticeCountAsync(coach.UserId)).Should().Be(1);
        (await NewMessageNoticeCountAsync(client.UserId)).Should().Be(0);
    }

    [Fact]
    public async Task Send_CoachWritesToClient_CreatesNoNoticeForTheClient()
    {
        var (coach, client, conversationId) = await SeedConversationAsync();

        var response = await coach.Http.PostAsJsonAsync(
            $"/conversations/{conversationId}/messages", new { Text = "Hello client" }, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        (await NewMessageNoticeCountAsync(client.UserId)).Should().Be(0);
        (await NewMessageNoticeCountAsync(coach.UserId)).Should().Be(0);
    }
}
