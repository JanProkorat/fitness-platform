using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Client.GetClientPayments;
using FitnessPlatform.Application.Features.ClientPayments.GetClientPaymentSummary;
using FitnessPlatform.Application.Features.ClientPayments.Shared;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static FitnessPlatform.Tests.Endpoints.ClientPayments.ClientPaymentFixtures;

namespace FitnessPlatform.Tests.Endpoints.ClientPayments;

/// <summary>
/// A fixed-length package keeps all its payments when the collaboration ends: the coach and the client can
/// still see and settle them, while the terms themselves are closed for good.
/// </summary>
[Collection(TestCollection.Name)]
public class PaymentsAfterEndIntegrationTests(FitnessApiFactory factory)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    /// <summary>A three-payment monthly package, an ended collaboration after the first two rows exist.</summary>
    private async Task<(PaymentWorld World, Guid PackageId, List<ClientPaymentRowDto> Rows)> EndedFixedLengthAsync()
    {
        var world = await CreateWorldAsync(factory);
        var packageId = await CreatePackageAsync(world.Coach, runsFor: 3);
        await SetTermsOkAsync(world, packageId);
        await EndCollaborationAsync(world);

        return (world, packageId, (await ListAsync(world)).OrderBy(p => p.PeriodStart).ToList());
    }

    private async Task<List<ClientPayment>> StoredRowsAsync(PaymentWorld world)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        return await db.ClientPayments.AsNoTracking()
            .Where(p => p.ClientPaymentAssignment.ProfessionalProfileId == world.Coach.ProfileId
                && p.ClientPaymentAssignment.ClientProfileId == world.Client.ProfileId
                && p.PeriodStart != null)
            .OrderBy(p => p.PeriodStart)
            .ToListAsync(Ct);
    }

    private async Task<GetClientPaymentsResponse> ClientListAsync(Actor client)
    {
        var response = await client.Http.GetAsync("/client/payments", Ct);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        return await ReadAsync<GetClientPaymentsResponse>(response);
    }

    [Fact]
    public async Task EndCollaboration_FixedLengthPackage_KeepsEveryRunWithFrozenFigures()
    {
        var (world, _, rows) = await EndedFixedLengthAsync();

        rows.Select(p => p.PeriodStart).Should().Equal(Today, Today.AddMonths(1), Today.AddMonths(2));
        var stored = await StoredRowsAsync(world);
        stored.Should().HaveCount(3);

        foreach (var kept in stored.Where(p => p.PeriodStart > Today))
        {
            kept.Status.Should().Be(ClientPaymentStatus.Upcoming);
            kept.Amount.Should().Be(2500m);
            kept.BasePrice.Should().Be(2500m);
            kept.PackageName.Should().Be("Online coaching");
            kept.Currency.Should().Be(PaymentCurrency.CZK);
        }

        stored.Where(p => p.PeriodStart > Today).Should().OnlyContain(p => p.IsKeptAfterEnd);
        stored.Where(p => p.PeriodStart <= Today).Should().OnlyContain(p => !p.IsKeptAfterEnd);
        rows.Where(p => p.PeriodStart > Today).Should().OnlyContain(p => p.Amount == 2500m && p.PackageName == "Online coaching");
    }

    [Fact]
    public async Task Summary_AfterTheEnd_NamesTheClientFlagsTheEndAndShowsTheKeptPayment()
    {
        var (world, _, _) = await EndedFixedLengthAsync();

        var response = await world.Coach.Http.GetAsync($"{world.Route}/summary", Ct);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var summary = await ReadAsync<GetClientPaymentSummaryResponse>(response);
        summary.CollaborationEnded.Should().BeTrue();
        summary.ClientName.Should().Be("Eva Svobodová");
        summary.Terms.Should().BeNull();
        summary.NextPayment.Should().NotBeNull();
        summary.NextPayment!.Amount.Should().Be(2500m);
    }

    [Fact]
    public async Task MarkPaid_KeptPeriodAfterTheEnd_PaysTheFrozenAmount_AndAPaidOneConflicts()
    {
        var (world, _, rows) = await EndedFixedLengthAsync();
        var kept = rows.First(p => p.PeriodStart > Today);

        var paid = await PostActionAsync(world, kept.PaymentId, "mark-paid");

        paid.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ReadAsync<ClientPaymentRowDto>(paid)).Amount.Should().Be(2500m);
        (await ReadStoredAsync(factory, kept.PaymentId)).Amount.Should().Be(2500m);
        (await PostActionAsync(world, kept.PaymentId, "mark-paid")).StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Request_KeptPeriodAfterTheEnd_ReachesTheClientUnderTheEndedCoach_AndCanBeWaived()
    {
        var (world, _, rows) = await EndedFixedLengthAsync();
        var kept = rows.Where(p => p.PeriodStart > Today).ToList();

        var requested = await PostActionAsync(world, kept[0].PaymentId, "request", new { SendEmail = true });

        requested.StatusCode.Should().Be(HttpStatusCode.OK, await requested.Content.ReadAsStringAsync(Ct));
        var coach = (await ClientListAsync(world.Client)).Coaches.Should().ContainSingle().Subject;
        coach.CollaborationEnded.Should().BeTrue();
        coach.Requested.Should().ContainSingle().Which.PaymentId.Should().Be(kept[0].PaymentId);
        (await world.Client.Http.GetAsync($"/client/payments/{kept[0].PaymentId}", Ct)).StatusCode.Should().Be(HttpStatusCode.OK);

        var waived = await PostActionAsync(world, kept[0].PaymentId, "waive");

        waived.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ReadStoredAsync(factory, kept[0].PaymentId)).Status.Should().Be(ClientPaymentStatus.Waived);
    }

    [Fact]
    public async Task AfterTheEnd_AnotherCoachAndAnotherClient_Get404()
    {
        var (world, _, rows) = await EndedFixedLengthAsync();
        var kept = rows.First(p => p.PeriodStart > Today);
        await PostActionAsync(world, kept.PaymentId, "request", new { SendEmail = true });
        var strangerCoach = await CreateWorldAsync(factory);
        var otherClient = await AddClientAsync(world);

        foreach (var (method, path) in new[]
                 {
                     (HttpMethod.Get, "payments"),
                     (HttpMethod.Get, "summary"),
                     (HttpMethod.Post, $"payments/{kept.PaymentId}/mark-paid"),
                     (HttpMethod.Post, $"payments/{kept.PaymentId}/waive")
                 })
        {
            using var request = new HttpRequestMessage(method, $"{world.Route}/{path}");

            if (method == HttpMethod.Post)
            {
                request.Content = JsonContent.Create(new { });
            }

            (await strangerCoach.Coach.Http.SendAsync(request, Ct)).StatusCode.Should().Be(HttpStatusCode.NotFound, path);
        }

        (await otherClient.Http.GetAsync($"/client/payments/{kept.PaymentId}", Ct)).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ClientListAsync(otherClient)).Coaches.Should().BeEmpty();
    }

    [Fact]
    public async Task AfterTheEnd_SettingTermsOrAddingAOneOffPayment_StaysLiveLinkOnly()
    {
        var (world, packageId, _) = await EndedFixedLengthAsync();

        (await SetTermsAsync(world, packageId)).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await world.Coach.Http.PostAsJsonAsync(
                $"{world.Route}/one-off", new { Title = "Workshop", Amount = 300m, DueDate = Today.AddDays(10) }, Ct))
            .StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Reaccept_AfterAFixedLengthEnd_DropsTheKeptUpcomingRowsAndBillsFromTheNewTerms()
    {
        var (world, _, _) = await EndedFixedLengthAsync();
        var fresh = await CreatePackageAsync(world.Coach, name: "Fresh start");

        await AcceptInviteAsync(world, fresh);

        var rows = await ListAsync(world);
        rows.Select(p => p.PeriodStart).Should().BeEquivalentTo([Today, Today.AddMonths(1)]);
        rows.Single(p => p.PeriodStart == Today.AddMonths(1)).PackageName.Should().Be("Fresh start");
        var replacement = (await StoredRowsAsync(world)).Single(p => p.PeriodStart > Today);
        replacement.Amount.Should().BeNull("the kept frozen row was replaced by one that follows the new terms");
        replacement.IsKeptAfterEnd.Should().BeFalse();
    }

    [Fact]
    public async Task EndCollaboration_IndefinitePackage_FreezesTheStartedPeriodAtItsPriceAndALaterPackageNeverReprices()
    {
        var world = await CreateWorldAsync(factory);
        var longTerm = await CreatePackageAsync(world.Coach, 5000m, "Dlouhodobá", "EveryNWeeks", intervalWeeks: 5);
        await SetTermsOkAsync(world, longTerm);
        await EndCollaborationAsync(world);

        var frozen = (await StoredRowsAsync(world)).Should().ContainSingle().Subject;
        frozen.PeriodStart.Should().Be(Today);
        frozen.Amount.Should().Be(5000m);
        frozen.BasePrice.Should().Be(5000m);
        frozen.PackageName.Should().Be("Dlouhodobá");

        var threeMonths = await CreatePackageAsync(world.Coach, 3000m, "Tříměsíční", runsFor: 3);
        await AcceptInviteAsync(world, threeMonths);

        var rows = (await ListAsync(world)).OrderBy(p => p.PeriodStart).ToList();
        rows[0].PeriodStart.Should().Be(Today);
        rows[0].Amount.Should().Be(5000m);
        rows[0].PackageName.Should().Be("Dlouhodobá");
        rows[1].PeriodStart.Should().Be(Today.AddMonths(1));
        rows[1].Amount.Should().Be(3000m);
    }

    [Fact]
    public async Task Reaccept_WhileAKeptPeriodIsRequestedInTheFuture_KeepsItAndStillPlansTheNewTerms()
    {
        var (world, _, rows) = await EndedFixedLengthAsync();
        var requestedRow = rows.First(p => p.PeriodStart > Today);
        (await PostActionAsync(world, requestedRow.PaymentId, "request", new { SendEmail = true })).StatusCode.Should().Be(HttpStatusCode.OK);
        var fresh = await CreatePackageAsync(world.Coach, name: "Fresh start");

        await AcceptInviteAsync(world, fresh);

        var after = await ListAsync(world);
        after.Select(p => p.PeriodStart).Should().BeEquivalentTo([Today, Today.AddMonths(1), Today.AddMonths(2)]);
        after.Single(p => p.PaymentId == requestedRow.PaymentId).Status.Should().Be(ClientPaymentStatus.Requested);
        var newRow = after.Single(p => p.PeriodStart == Today.AddMonths(2));
        newRow.Status.Should().Be(ClientPaymentStatus.Upcoming);
        newRow.PackageName.Should().Be("Fresh start");
        (await StoredRowsAsync(world)).Single(p => p.PeriodStart == Today.AddMonths(2)).IsKeptAfterEnd.Should().BeFalse();
        (await StoredRowsAsync(world)).Single(p => p.PeriodStart == Today.AddMonths(1)).IsKeptAfterEnd.Should().BeTrue();
    }

    [Fact]
    public async Task Reaccept_WhileAKeptPeriodIsPaid_KeepsItAndDoesNotPlanItsDayTwice()
    {
        var (world, _, rows) = await EndedFixedLengthAsync();
        var paidRow = rows.First(p => p.PeriodStart > Today);
        (await PostActionAsync(world, paidRow.PaymentId, "mark-paid")).StatusCode.Should().Be(HttpStatusCode.OK);
        var fresh = await CreatePackageAsync(world.Coach, name: "Fresh start");

        await AcceptInviteAsync(world, fresh);

        var after = await ListAsync(world);
        after.Select(p => p.PeriodStart).Should().BeEquivalentTo([Today, Today.AddMonths(1), Today.AddMonths(2)]);
        after.Single(p => p.PaymentId == paidRow.PaymentId).Status.Should().Be(ClientPaymentStatus.Paid);
        after.Single(p => p.PeriodStart == Today.AddMonths(2)).PackageName.Should().Be("Fresh start");
    }
}
