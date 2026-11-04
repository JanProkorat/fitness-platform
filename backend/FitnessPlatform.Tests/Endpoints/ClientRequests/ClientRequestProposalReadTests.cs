using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static FitnessPlatform.Tests.Endpoints.ClientPayments.ClientPaymentFixtures;
using static FitnessPlatform.Tests.Endpoints.PaymentSettings.PaymentSettingsFixtures;

namespace FitnessPlatform.Tests.Endpoints.ClientRequests;

/// <summary>
/// Where an open package proposal shows up on the read side: the coach's request and pending lists, the client's
/// request list, the pending count, the public profile and the join-request chat exemption.
/// </summary>
[Collection(TestCollection.Name)]
public class ClientRequestProposalReadTests(FitnessApiFactory factory)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private async Task<(Actor Coach, Actor Client, Guid RequestId, Guid PackageId, Guid DiscountId)> ProposedAsync()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(Ct);
        await SubscribeAsync(factory, coach, canUsePayments: true);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var packageId = await CreatePackageAsync(coach, 1800m, "Coaching");
        var discountId = await CreateDiscountAsync(coach, 15m, name: "Welcome");

        var created = await client.Http.PostAsJsonAsync("/client/requests", new { ProfessionalPublicId = coach.PublicId }, Ct);
        var requestId = (await created.Content.ReadFromJsonAsync<RequestCreated>(Ct))!.PublicId;

        var proposed = await coach.Http.PostAsJsonAsync(
            $"/trainer/client-requests/{requestId}/propose-package",
            new { PackagePublicId = packageId, DiscountPublicId = discountId, Statement = "Let us start" },
            Ct);
        proposed.StatusCode.Should().Be(HttpStatusCode.NoContent);

        return (coach, client, requestId, packageId, discountId);
    }

    private static async Task<JsonElement> GetJsonAsync(Actor actor, string url)
    {
        var response = await actor.Http.GetAsync(url, Ct);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        return JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct)).RootElement.Clone();
    }

    private static JsonElement Single(JsonElement list, Guid publicId) =>
        list.EnumerateArray().Single(item => item.GetProperty("publicId").GetGuid() == publicId);

    [Fact]
    public async Task GetIncomingRequests_ListsTheProposalWithItsPackageAndDiscount()
    {
        var (coach, _, requestId, packageId, discountId) = await ProposedAsync();

        var body = await GetJsonAsync(coach, "/trainer/client-requests");

        var row = Single(body.GetProperty("requests"), requestId);
        row.GetProperty("status").GetString().Should().Be("PackageProposed");
        var proposal = row.GetProperty("proposal");
        proposal.GetProperty("package").GetProperty("publicId").GetGuid().Should().Be(packageId);
        proposal.GetProperty("discount").GetProperty("publicId").GetGuid().Should().Be(discountId);
        row.GetProperty("package").ValueKind.Should().Be(JsonValueKind.Null, "the client attached no package");
    }

    [Fact]
    public async Task GetPendingClients_ListsTheProposalRow()
    {
        var (coach, _, requestId, packageId, _) = await ProposedAsync();

        var body = await GetJsonAsync(coach, "/trainer/clients/pending");

        var row = Single(body.GetProperty("rows"), requestId);
        row.GetProperty("proposal").GetProperty("package").GetProperty("publicId").GetGuid().Should().Be(packageId);
    }

    [Fact]
    public async Task GetMyRequests_ShowsTheClientTheProposalUntilItIsAnswered()
    {
        var (_, client, requestId, packageId, discountId) = await ProposedAsync();

        var open = Single((await GetJsonAsync(client, "/client/requests")).GetProperty("requests"), requestId);

        open.GetProperty("status").GetString().Should().Be("PackageProposed");
        open.GetProperty("proposal").GetProperty("statement").GetString().Should().Be("Let us start");
        open.GetProperty("proposal").GetProperty("package").GetProperty("publicId").GetGuid().Should().Be(packageId);
        open.GetProperty("proposal").GetProperty("discount").GetProperty("publicId").GetGuid().Should().Be(discountId);

        (await client.Http.PostAsJsonAsync($"/client/requests/{requestId}/decline-proposal", new { }, Ct))
            .StatusCode.Should().Be(HttpStatusCode.NoContent);

        var declined = Single((await GetJsonAsync(client, "/client/requests")).GetProperty("requests"), requestId);
        declined.GetProperty("status").GetString().Should().Be("ProposalDeclined");
        declined.GetProperty("proposal").ValueKind.Should().Be(JsonValueKind.Null);
    }

    [Fact]
    public async Task OpenProposal_CountsAsPendingForTheCoachAndAsARequestOnTheProfile()
    {
        var (coach, client, _, _, _) = await ProposedAsync();

        var clients = await GetJsonAsync(coach, "/trainer/clients");
        var profile = await GetJsonAsync(client, $"/professionals/{coach.PublicId}");

        clients.GetProperty("tabCounts").GetProperty("pending").GetInt32().Should().Be(1);
        profile.GetProperty("hasPendingRequest").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task StartConversation_ClientWithAnOpenProposalMayStartTheThread()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.ClientRequests.Add(new ClientRequest
            {
                ClientProfileId = client.ProfileId,
                ProfessionalProfileId = coach.ProfileId,
                Status = ClientRequestStatus.PackageProposed,
            });
            await db.SaveChangesAsync(Ct);
        }

        var response = await client.Http.PostAsJsonAsync("/conversations", new { ParticipantId = coach.PublicId }, Ct);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    private record RequestCreated(Guid PublicId);
}
