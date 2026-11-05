using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FormUp.Application.Domain.Entities;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Infrastructure.Data;
using FormUp.Tests.Builders;
using FormUp.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static FormUp.Tests.Endpoints.ClientPayments.ClientPaymentFixtures;
using static FormUp.Tests.Endpoints.PaymentSettings.PaymentSettingsFixtures;

namespace FormUp.Tests.Endpoints.Trainers.ClientRequests;

/// <summary>
/// A coach withdraws a package proposal the client has not answered (POST /trainer/client-requests/{id}/withdraw-proposal).
/// </summary>
[Collection(TestCollection.Name)]
public class WithdrawClientRequestProposalTests(FitnessApiFactory factory)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private async Task<(Actor Coach, Actor Client, Guid RequestId, Guid PackageId)> ProposedAsync()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(Ct);
        await SubscribeAsync(factory, coach, canUsePayments: true);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var packageId = await CreatePackageAsync(coach);

        var created = await client.Http.PostAsJsonAsync("/client/requests", new { ProfessionalPublicId = coach.PublicId }, Ct);
        var requestId = (await created.Content.ReadFromJsonAsync<RequestCreated>(Ct))!.PublicId;

        var proposed = await coach.Http.PostAsJsonAsync(
            $"/trainer/client-requests/{requestId}/propose-package", new { PackagePublicId = packageId, Statement = "Hi" }, Ct);
        proposed.StatusCode.Should().Be(HttpStatusCode.NoContent);

        return (coach, client, requestId, packageId);
    }

    private static Task<HttpResponseMessage> WithdrawAsync(Actor coach, Guid requestId) =>
        coach.Http.PostAsJsonAsync($"/trainer/client-requests/{requestId}/withdraw-proposal", new { }, Ct);

    private async Task<ClientRequest> StoredRequestAsync(Guid requestId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        return await db.ClientRequests.AsNoTracking().SingleAsync(r => r.PublicId == requestId, Ct);
    }

    [Fact]
    public async Task Withdraw_OpenProposal_ReturnsToPendingClearsItAndNotifiesTheClient()
    {
        var (coach, client, requestId, packageId) = await ProposedAsync();

        var response = await WithdrawAsync(coach, requestId);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var stored = await StoredRequestAsync(requestId);
        stored.Status.Should().Be(ClientRequestStatus.Pending);
        stored.ProposedPackageId.Should().BeNull();
        stored.ProposedDiscountId.Should().BeNull();
        stored.ProposedAt.Should().BeNull();
        stored.Statement.Should().BeNull();

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var notification = await db.Notifications.SingleAsync(
                n => n.RecipientUserId == client.UserId && n.Type == NotificationType.ClientRequestProposalWithdrawn, Ct);
            JsonDocument.Parse(notification.Data!).RootElement.GetProperty("requestId").GetString().Should().Be(requestId.ToString());
        }

        factory.Services.GetRequiredService<FakeRealtimeNotifier>().Calls.Should().Contain(
            call => call.UserId == client.UserId && call.EventType == "clientrequestproposalwithdrawn");

        // A pending request takes a new proposal again.
        var again = await coach.Http.PostAsJsonAsync(
            $"/trainer/client-requests/{requestId}/propose-package", new { PackagePublicId = packageId }, Ct);
        again.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Withdraw_UnknownRequestOrAnotherCoachsRequest_Returns404()
    {
        var (_, _, requestId, _) = await ProposedAsync();
        var otherCoach = await TestActors.Trainer(factory).CreateAsync(Ct);

        var unknown = await WithdrawAsync(otherCoach, Guid.NewGuid());
        var foreign = await WithdrawAsync(otherCoach, requestId);

        unknown.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ProblemCodeAsync(unknown)).Should().Be("CLIENT_REQUEST_NOT_FOUND");
        foreign.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ProblemCodeAsync(foreign)).Should().Be("CLIENT_REQUEST_NOT_FOUND");
        (await StoredRequestAsync(requestId)).Status.Should().Be(ClientRequestStatus.PackageProposed);
    }

    [Fact]
    public async Task Withdraw_RequestWithoutOpenProposal_Returns409InvalidState()
    {
        var (coach, _, requestId, _) = await ProposedAsync();
        (await WithdrawAsync(coach, requestId)).StatusCode.Should().Be(HttpStatusCode.NoContent);

        var second = await WithdrawAsync(coach, requestId);

        second.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(second)).Should().Be("CLIENT_REQUEST_INVALID_STATE");
    }

    [Fact]
    public async Task Withdraw_ByCoachWhoseRoleWasRemoved_Returns403CoachRoleRemoved()
    {
        var coach = await TestActors.Trainer(factory).WithRemovedCoachRoles(UserRole.Trainer).CreateAsync(Ct);

        var response = await WithdrawAsync(coach, Guid.NewGuid());

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await ErrorCodesAsync(response)).Should().Contain("COACH_ROLE_REMOVED");
    }

    private static async Task<List<JsonElement>> EventsAsync(Actor viewer)
    {
        var conversations = JsonDocument.Parse(await (await viewer.Http.GetAsync("/conversations", Ct)).Content.ReadAsStringAsync(Ct));
        var id = conversations.RootElement.EnumerateArray().Single().GetProperty("id").GetGuid();
        var messages = JsonDocument.Parse(await (await viewer.Http.GetAsync($"/conversations/{id}/messages", Ct)).Content.ReadAsStringAsync(Ct));

        return messages.RootElement.GetProperty("items").EnumerateArray()
            .Where(m => m.GetProperty("kind").GetString() == "Event")
            .Select(m => m.Clone())
            .ToList();
    }

    private async Task<Guid> InsertRequestWithoutThreadAsync(Actor coach, Actor client, ClientRequestStatus status)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var request = new ClientRequest { ClientProfileId = client.ProfileId, ProfessionalProfileId = coach.ProfileId, Status = status };
        db.ClientRequests.Add(request);
        await db.SaveChangesAsync(Ct);

        return request.PublicId;
    }

    private async Task<bool> ThreadExistsAsync(Actor coach, Actor client)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        return await db.Conversations.AnyAsync(c => c.ClientUserId == client.UserId && c.ProfessionalUserId == coach.UserId, Ct);
    }

    [Fact]
    public async Task Withdraw_WritesACoachAuthoredWithdrawnEventAndTheProposalCardReadsCancelled()
    {
        var (coach, client, requestId, _) = await ProposedAsync();

        (await WithdrawAsync(coach, requestId)).StatusCode.Should().Be(HttpStatusCode.NoContent);

        var events = await EventsAsync(client);
        var withdrawn = events.Should().ContainSingle(e => e.GetProperty("eventType").GetString() == "Withdrawn").Subject;
        withdrawn.GetProperty("senderId").GetGuid().Should().Be(coach.UserId);
        withdrawn.GetProperty("eventSourceId").GetGuid().Should().Be(requestId);
        events.Single(e => e.GetProperty("eventType").GetString() == "ProposalSent")
            .GetProperty("eventStatus").GetString().Should().Be("Cancelled");
        events.Single(e => e.GetProperty("eventType").GetString() == "Requested")
            .GetProperty("eventStatus").GetString().Should().Be("Pending");
    }

    [Fact]
    public async Task Withdraw_WhenNoThreadExists_CreatesNone()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var requestId = await InsertRequestWithoutThreadAsync(coach, client, ClientRequestStatus.PackageProposed);

        (await WithdrawAsync(coach, requestId)).StatusCode.Should().Be(HttpStatusCode.NoContent);

        (await ThreadExistsAsync(coach, client)).Should().BeFalse();
    }

    private record RequestCreated(Guid PublicId);
}
