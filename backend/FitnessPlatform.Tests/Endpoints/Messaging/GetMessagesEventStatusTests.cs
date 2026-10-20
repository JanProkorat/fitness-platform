using System.Net;
using System.Net.Http.Json;
using System.Text;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Endpoints.Messaging;

/// <summary>
/// <c>GET /conversations/{id}/messages</c>: cooperation event messages carry the current status
/// of the invite or request they refer to, so the chat card can show its label.
/// </summary>
[Collection(TestCollection.Name)]
public class GetMessagesEventStatusTests(FitnessApiFactory factory)
{
    private record ConversationItem(Guid Id);

    private record MessagesResult(List<MessageItem> Items);

    private record MessageItem(string Kind, string? EventType, Guid? EventSourceId, string? EventStatus);

    private record CreatedInvite(Guid PublicId);

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static StringContent EmptyJson() => new("{}", Encoding.UTF8, "application/json");

    private async Task<(Actor Coach, Actor Client, Guid InviteId)> InviteVerifiedClientAsync()
    {
        var coach = await TestActors.Trainer(factory).WithName("Coach", "Carl").CreateAsync(Ct);
        var client = await TestActors.Client(factory).Verified().WithName("Jane", "Doe").CreateAsync(Ct);

        var response = await coach.Http.PostAsJsonAsync(
            "/trainer/pending-invites", new { Email = client.Email, Message = "Welcome" }, Ct);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var inviteId = (await response.Content.ReadFromJsonAsync<CreatedInvite>(cancellationToken: Ct))!.PublicId;
        return (coach, client, inviteId);
    }

    private static async Task<List<MessageItem>> MessagesAsync(Actor viewer)
    {
        var conversations = await viewer.Http.GetAsync("/conversations", Ct);
        conversations.StatusCode.Should().Be(HttpStatusCode.OK);
        var list = await conversations.Content.ReadFromJsonAsync<List<ConversationItem>>(cancellationToken: Ct);
        var id = list.Should().ContainSingle().Subject.Id;

        var response = await viewer.Http.GetAsync($"/conversations/{id}/messages", Ct);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return (await response.Content.ReadFromJsonAsync<MessagesResult>(cancellationToken: Ct))!.Items;
    }

    private static MessageItem InvitedCard(List<MessageItem> messages) =>
        messages.Should().ContainSingle(m => m.EventType == "Invited" && m.Kind == "Event").Subject;

    [Fact]
    public async Task InvitedCard_ForPendingInvite_ReportsPending_AndExposesSourceId()
    {
        var (_, client, inviteId) = await InviteVerifiedClientAsync();

        var card = InvitedCard(await MessagesAsync(client));

        card.EventStatus.Should().Be("Pending");
        card.EventSourceId.Should().Be(inviteId);
    }

    [Fact]
    public async Task InvitedCard_AfterClientDeclines_ReportsDeclined()
    {
        var (_, client, inviteId) = await InviteVerifiedClientAsync();
        (await client.Http.PostAsync($"/client/invites/{inviteId}/decline", EmptyJson(), Ct))
            .StatusCode.Should().Be(HttpStatusCode.NoContent);

        InvitedCard(await MessagesAsync(client)).EventStatus.Should().Be("Declined");
    }

    [Fact]
    public async Task InvitedCard_AfterClientAccepts_ReportsAccepted()
    {
        var (_, client, inviteId) = await InviteVerifiedClientAsync();
        (await client.Http.PostAsync($"/client/invites/{inviteId}/accept", EmptyJson(), Ct))
            .StatusCode.Should().Be(HttpStatusCode.NoContent);

        InvitedCard(await MessagesAsync(client)).EventStatus.Should().Be("Accepted");
    }

    [Fact]
    public async Task InvitedCard_AfterCoachCancels_ReportsCancelled()
    {
        var (coach, client, inviteId) = await InviteVerifiedClientAsync();
        (await coach.Http.DeleteAsync($"/trainer/pending-invites/{inviteId}", Ct))
            .StatusCode.Should().Be(HttpStatusCode.NoContent);

        InvitedCard(await MessagesAsync(client)).EventStatus.Should().Be("Cancelled");
    }

    [Fact]
    public async Task InvitedCard_ForInviteOlderThanSevenDays_ReportsExpired()
    {
        var (_, client, inviteId) = await InviteVerifiedClientAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var invite = await db.PendingInvites.SingleAsync(pi => pi.PublicId == inviteId, Ct);
            invite.SentAt = DateTime.UtcNow.AddDays(-8);
            await db.SaveChangesAsync(Ct);
        }

        InvitedCard(await MessagesAsync(client)).EventStatus.Should().Be("Expired");
    }

    [Fact]
    public async Task AcceptingAnExpiredInvite_Returns409_AndLeavesItPending()
    {
        var (_, client, inviteId) = await InviteVerifiedClientAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var invite = await db.PendingInvites.SingleAsync(pi => pi.PublicId == inviteId, Ct);
            invite.SentAt = DateTime.UtcNow.AddDays(-8);
            await db.SaveChangesAsync(Ct);
        }

        var response = await client.Http.PostAsync($"/client/invites/{inviteId}/accept", EmptyJson(), Ct);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await response.Content.ReadAsStringAsync(Ct)).Should().Contain("INVITE_EXPIRED");
        using var verifyScope = factory.Services.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await verifyDb.PendingInvites.SingleAsync(pi => pi.PublicId == inviteId, Ct))
            .Status.Should().Be(PendingInviteStatus.Pending);
    }

    [Theory]
    [InlineData(ClientRequestStatus.Pending, "Pending")]
    [InlineData(ClientRequestStatus.Accepted, "Accepted")]
    [InlineData(ClientRequestStatus.Rejected, "Declined")]
    [InlineData(ClientRequestStatus.Cancelled, "Cancelled")]
    public async Task RequestedCard_ReportsRequestStatus(ClientRequestStatus stored, string expected)
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        (await client.Http.PostAsJsonAsync("/client/requests", new { ProfessionalPublicId = coach.PublicId }, Ct))
            .StatusCode.Should().Be(HttpStatusCode.Created);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var request = await db.ClientRequests.SingleAsync(r => r.ClientProfileId == client.ProfileId, Ct);
            request.Status = stored;
            await db.SaveChangesAsync(Ct);
        }

        var card = (await MessagesAsync(coach)).Should()
            .ContainSingle(m => m.EventType == "Requested" && m.Kind == "Event").Subject;

        card.EventStatus.Should().Be(expected);
    }
}
