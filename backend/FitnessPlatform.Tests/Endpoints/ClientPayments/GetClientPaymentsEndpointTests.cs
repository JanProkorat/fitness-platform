using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Client.GetClientPayments;
using FitnessPlatform.Application.Features.ClientPayments.GetMyPayment;
using FitnessPlatform.Application.Features.ClientPayments.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static FitnessPlatform.Tests.Endpoints.ClientPayments.ClientPaymentFixtures;
using static FitnessPlatform.Tests.Endpoints.PaymentSettings.PaymentSettingsFixtures;

namespace FitnessPlatform.Tests.Endpoints.ClientPayments;

/// <summary>
/// Integration tests for the client's own payment endpoints: GET /client/payments and GET /client/payments/{PaymentId}.
/// </summary>
[Collection(TestCollection.Name)]
public class GetClientPaymentsEndpointTests(FitnessApiFactory factory)
{
    private async Task<GetClientPaymentsResponse> GetOwnAsync(Actor client)
    {
        var response = await client.Http.GetAsync("/client/payments", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        return await ReadAsync<GetClientPaymentsResponse>(response);
    }

    [Fact]
    public async Task Get_ClientWithNoCoachLinks_ReturnsAnEmptyList()
    {
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);

        (await GetOwnAsync(client)).Coaches.Should().BeEmpty();
    }

    [Fact]
    public async Task Get_OnlyRequestedAndPaidPayments_AreVisible()
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world, 2500m);
        await PostActionAsync(world, rows[0].PaymentId, "request", new { SendEmail = true });
        var oneOff = await ReadAsync<ClientPaymentRowDto>(await world.Coach.Http.PostAsJsonAsync(
            $"{world.Route}/one-off", new { Title = "Workshop", Amount = 300m, DueDate = Today.AddDays(9) }, TestContext.Current.CancellationToken));
        await PostActionAsync(world, oneOff.PaymentId, "mark-paid");
        var waived = await ReadAsync<ClientPaymentRowDto>(await world.Coach.Http.PostAsJsonAsync(
            $"{world.Route}/one-off", new { Title = "Waived one", Amount = 50m, DueDate = Today.AddDays(9) }, TestContext.Current.CancellationToken));
        await PostActionAsync(world, waived.PaymentId, "waive");

        var own = await GetOwnAsync(world.Client);

        var coach = own.Coaches.Should().ContainSingle().Subject;
        coach.CoachName.Should().Be("Martin Král");
        coach.Requested.Should().ContainSingle().Which.PaymentId.Should().Be(rows[0].PaymentId);
        coach.Paid.Should().ContainSingle().Which.PaymentId.Should().Be(oneOff.PaymentId);
    }

    [Fact]
    public async Task Get_RequestedPayment_CarriesTheBankDetailsAndAQrPayload()
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world, 2500m);
        await PostActionAsync(world, rows[0].PaymentId, "request", new { SendEmail = true });

        var item = (await GetOwnAsync(world.Client)).Coaches.Single().Requested.Single();

        item.Status.Should().Be(ClientPaymentStatus.Requested);
        item.Iban.Should().Be(ValidIban);
        item.AccountHolder.Should().Be("Martin Král");
        item.VariableSymbol.Should().Be(rows[0].VariableSymbol);
        item.Amount.Should().Be(2500m);
        item.QrPayload.Should().StartWith("SPD*1.0*ACC:CZ6508000000192000145399*AM:2500.00*CC:CZK")
            .And.Contain($"*X-VS:{rows[0].VariableSymbol}");
    }

    [Fact]
    public async Task Get_RequestedPaymentPastItsDueDate_IsOverdue()
    {
        var world = await CreateWorldAsync(factory);
        await StartMonthlyAsync(world);
        var seeded = await SeedPastPaymentAsync(world, Today.AddDays(-2), ClientPaymentStatus.Requested);

        var item = (await GetOwnAsync(world.Client)).Coaches.Single().Requested.Single(p => p.PaymentId == seeded);

        item.Status.Should().Be(ClientPaymentStatus.Overdue);
    }

    [Fact]
    public async Task Get_PaidPayment_ShowsNoBankDetailsAndNoQr()
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world);
        await PostActionAsync(world, rows[0].PaymentId, "request", new { SendEmail = true });
        await PostActionAsync(world, rows[0].PaymentId, "mark-paid", new { PaidOn = Today.AddDays(-1) });

        var paid = (await GetOwnAsync(world.Client)).Coaches.Single().Paid.Single();

        paid.Status.Should().Be(ClientPaymentStatus.Paid);
        paid.PaidOn.Should().Be(Today.AddDays(-1));
        paid.Iban.Should().BeNull();
        paid.QrPayload.Should().BeNull();
    }

    [Fact]
    public async Task Get_CoachDroppedBelowThePaymentsTier_ClientStillSeesWhatWasAlreadyRequested()
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world);
        await PostActionAsync(world, rows[0].PaymentId, "request", new { SendEmail = true });

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.CoachSubscriptions
                .Where(s => s.ProfessionalProfileId == world.Coach.ProfileId)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, SubscriptionStatus.Canceled), TestContext.Current.CancellationToken);
        }

        (await GetOwnAsync(world.Client)).Coaches.Single().Requested.Should().ContainSingle();
        (await world.Coach.Http.GetAsync($"{world.Route}/payments", TestContext.Current.CancellationToken))
            .StatusCode.Should().Be(HttpStatusCode.Forbidden, "the tier gate applies to the coach, not to the client");
    }

    [Fact]
    public async Task Get_LinkEnded_HidesThatCoachsPayments()
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world);
        await PostActionAsync(world, rows[0].PaymentId, "request", new { SendEmail = true });

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.ClientProfessionalLinks
                .Where(l => l.ProfessionalProfileId == world.Coach.ProfileId)
                .ExecuteUpdateAsync(s => s.SetProperty(l => l.IsActive, false), TestContext.Current.CancellationToken);
        }

        (await GetOwnAsync(world.Client)).Coaches.Should().BeEmpty();
    }

    [Fact]
    public async Task Get_NeverShowsAnotherClientsPayments()
    {
        var world = await CreateWorldAsync(factory);
        var otherClient = world with { Client = await AddClientAsync(world) };
        var otherRows = await StartMonthlyAsync(otherClient);
        await PostActionAsync(otherClient, otherRows[0].PaymentId, "request", new { SendEmail = true });
        var rows = await StartMonthlyAsync(world);
        await PostActionAsync(world, rows[0].PaymentId, "request", new { SendEmail = true });

        var own = await GetOwnAsync(world.Client);

        own.Coaches.Single().Requested.Select(p => p.PaymentId).Should().Equal(rows[0].PaymentId);
    }

    [Fact]
    public async Task Get_PaymentsOfTwoCoaches_AreGroupedPerCoach()
    {
        var first = await CreateWorldAsync(factory);
        var rowsFirst = await StartMonthlyAsync(first);
        await PostActionAsync(first, rowsFirst[0].PaymentId, "request", new { SendEmail = true });

        var secondCoach = await TestActors.Nutritionist(factory).WithName("Petra", "Dvořáková").CreateAsync(TestContext.Current.CancellationToken);
        await SubscribeAsync(factory, secondCoach, canUsePayments: true);
        await SetBankAccountAsync(factory, secondCoach, OtherIban, "Petra Dvořáková");
        await TestActors.Link(factory, secondCoach, first.Client).AsRole(UserRole.Nutritionist).CreateAsync(TestContext.Current.CancellationToken);
        var second = first with { Coach = secondCoach };
        var rowsSecond = await StartMonthlyAsync(second, 900m);
        await PostActionAsync(second, rowsSecond[0].PaymentId, "request", new { SendEmail = true });

        var own = await GetOwnAsync(first.Client);

        own.Coaches.Should().HaveCount(2);
        own.Coaches.Select(c => c.CoachName).Should().BeEquivalentTo("Martin Král", "Petra Dvořáková");
        own.Coaches.Single(c => c.CoachName == "Petra Dvořáková").Requested.Single().Iban.Should().Be(OtherIban);
    }

    [Fact]
    public async Task GetOne_OwnRequestedPayment_ReturnsItWithTheCoachName()
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world);
        await PostActionAsync(world, rows[0].PaymentId, "request", new { SendEmail = true });

        var response = await world.Client.Http.GetAsync($"/client/payments/{rows[0].PaymentId}", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var payment = await ReadAsync<GetMyPaymentResponse>(response);
        payment.CoachName.Should().Be("Martin Král");
        payment.Iban.Should().Be(ValidIban);
        payment.QrPayload.Should().StartWith("SPD*1.0*");
    }

    [Fact]
    public async Task GetOne_AnotherClientsPayment_Returns404()
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world);
        await PostActionAsync(world, rows[0].PaymentId, "request", new { SendEmail = true });
        var stranger = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);

        var response = await stranger.Http.GetAsync($"/client/payments/{rows[0].PaymentId}", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Theory]
    [InlineData("upcoming")]
    [InlineData("waived")]
    public async Task GetOne_NotRequestedNorPaid_Returns404(string state)
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world);

        if (state == "waived")
        {
            await PostActionAsync(world, rows[0].PaymentId, "waive");
        }

        var response = await world.Client.Http.GetAsync($"/client/payments/{rows[0].PaymentId}", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetOne_CoachNoLongerLinked_Returns404()
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world);
        await PostActionAsync(world, rows[0].PaymentId, "request", new { SendEmail = true });

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.ClientProfessionalLinks
                .Where(l => l.ProfessionalProfileId == world.Coach.ProfileId)
                .ExecuteUpdateAsync(s => s.SetProperty(l => l.IsActive, false), TestContext.Current.CancellationToken);
        }

        var response = await world.Client.Http.GetAsync($"/client/payments/{rows[0].PaymentId}", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
