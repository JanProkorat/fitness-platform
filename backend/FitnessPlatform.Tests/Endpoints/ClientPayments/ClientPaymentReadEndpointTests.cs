using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientPayments.GetClientPaymentHistory;
using FitnessPlatform.Application.Features.ClientPayments.GetClientPaymentSummary;
using FitnessPlatform.Application.Features.ClientPayments.Shared;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using static FitnessPlatform.Tests.Endpoints.ClientPayments.ClientPaymentFixtures;
using static FitnessPlatform.Tests.Endpoints.PaymentSettings.PaymentSettingsFixtures;

namespace FitnessPlatform.Tests.Endpoints.ClientPayments;

/// <summary>
/// Integration tests for the coach's read endpoints: payment summary, payment list and change history.
/// </summary>
[Collection(TestCollection.Name)]
public class ClientPaymentReadEndpointTests(FitnessApiFactory factory)
{
    private async Task<GetClientPaymentSummaryResponse> GetSummaryAsync(PaymentWorld world)
    {
        var response = await world.Coach.Http.GetAsync($"{world.Route}/summary", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        return await ReadAsync<GetClientPaymentSummaryResponse>(response);
    }

    [Fact]
    public async Task List_ClientWithoutTerms_ReturnsAnEmptyList()
    {
        var world = await CreateWorldAsync(factory);

        (await ListAsync(world)).Should().BeEmpty();
    }

    [Fact]
    public async Task Summary_ClientWithoutTerms_HasNoPackageAndKnowsTheBankAccountState()
    {
        var world = await CreateWorldAsync(factory, bankAccount: false);

        var summary = await GetSummaryAsync(world);

        summary.Terms.Should().BeNull();
        summary.Price.Should().BeNull();
        summary.NextPayment.Should().BeNull();
        summary.BankAccountSet.Should().BeFalse();
        summary.ClientSince.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromMinutes(5));
    }

    [Fact]
    public async Task Summary_WithTermsAndDiscount_ShowsThePriceBreakdownAndTheNextPayment()
    {
        var world = await CreateWorldAsync(factory);
        var discountId = await CreateDiscountAsync(world.Coach, 30m);
        var rows = await StartMonthlyAsync(world, 2500m, discountId);

        var summary = await GetSummaryAsync(world);

        summary.Terms!.PackageName.Should().Be("Online coaching");
        summary.Terms.DiscountName.Should().Be("Friends & family");
        summary.Price!.BasePrice.Should().Be(2500m);
        summary.Price.DiscountAmount.Should().Be(750m);
        summary.Price.Amount.Should().Be(1750m);
        summary.NextPeriodStart.Should().Be(rows[1].PeriodStart);
        summary.NextPayment!.PaymentId.Should().Be(rows[0].PaymentId);
        summary.NextPayment.Amount.Should().Be(1750m);
        summary.BankAccountSet.Should().BeTrue();
    }

    [Fact]
    public async Task Summary_AfterAPaymentIsPaid_CountsItAndReportsPaidUntilTheEndOfItsPeriod()
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world);
        var paid = await PostActionAsync(world, rows[0].PaymentId, "mark-paid");
        paid.StatusCode.Should().Be(HttpStatusCode.OK);

        var summary = await GetSummaryAsync(world);

        summary.PaidCount.Should().Be(1);
        summary.TotalCount.Should().Be(1);
        summary.PaidUntil.Should().Be(rows[0].PeriodEnd);
        summary.NextPayment!.PaymentId.Should().Be(rows[1].PaymentId);
    }

    [Fact]
    public async Task List_RequestedPaymentPastItsDueDate_IsReportedOverdue()
    {
        var world = await CreateWorldAsync(factory);
        await StartMonthlyAsync(world);
        var seeded = await SeedPastPaymentAsync(world, Today.AddDays(-3), ClientPaymentStatus.Requested);

        var rows = await ListAsync(world);

        rows.Single(p => p.PaymentId == seeded).Status.Should().Be(ClientPaymentStatus.Overdue);
        (await ReadStoredAsync(factory, seeded)).Status.Should().Be(ClientPaymentStatus.Requested, "overdue is derived and never stored");
    }

    [Fact]
    public async Task List_PaymentDueToday_IsNotYetOverdue()
    {
        var world = await CreateWorldAsync(factory);
        await StartMonthlyAsync(world);
        var seeded = await SeedPastPaymentAsync(world, Today, ClientPaymentStatus.Requested);

        (await ListAsync(world)).Single(p => p.PaymentId == seeded).Status.Should().Be(ClientPaymentStatus.Requested);
    }

    [Fact]
    public async Task List_UpcomingPayment_ShowsTheMessageTheClientWillSee()
    {
        var world = await CreateWorldAsync(factory);

        var rows = await StartMonthlyAsync(world);

        rows[0].Message.Should().Be($"Online coaching {Today.Month:D2}/{Today.Year}");
    }

    [Fact]
    public async Task List_NewestDueDateFirst()
    {
        var world = await CreateWorldAsync(factory);
        await StartMonthlyAsync(world);

        var rows = await ListAsync(world);

        rows.Select(p => p.DueDate).Should().BeInDescendingOrder();
    }

    [Fact]
    public async Task Reads_ClientOfAnotherCoach_Return404()
    {
        var world = await CreateWorldAsync(factory);
        var other = await CreateWorldAsync(factory);

        foreach (var path in new[] { "summary", "payments", "history" })
        {
            var response = await world.Coach.Http.GetAsync(
                $"/payments/clients/{other.Client.PublicId}/{path}", TestContext.Current.CancellationToken);

            response.StatusCode.Should().Be(HttpStatusCode.NotFound, path);
        }
    }

    [Fact]
    public async Task Reads_CoachBelowThePaymentsTier_Return403()
    {
        var world = await CreateWorldAsync(factory, entitled: false);

        foreach (var path in new[] { "summary", "payments", "history" })
        {
            var response = await world.Coach.Http.GetAsync($"{world.Route}/{path}", TestContext.Current.CancellationToken);

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden, path);
            (await ProblemCodeAsync(response)).Should().Be("PAYMENTS_NOT_ENTITLED");
        }
    }

    [Fact]
    public async Task History_ListsTheCoachActionsNewestFirstWithoutAnIbanOrClientName()
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world);
        (await PostActionAsync(world, rows[0].PaymentId, "mark-paid")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await PostActionAsync(world, rows[1].PaymentId, "waive", new { Reason = "Holiday" })).StatusCode.Should().Be(HttpStatusCode.OK);

        var response = await world.Coach.Http.GetAsync($"{world.Route}/history", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var history = await ReadAsync<GetClientPaymentHistoryResponse>(response);
        history.Entries.Select(e => e.Action).Should().Equal("WaiveClientPayment", "MarkClientPaymentPaid", "SetClientPaymentTerms");
        history.Entries[0].Detail.Should().Be("Holiday");
        history.Entries[0].PaymentId.Should().Be(rows[1].PaymentId);
        history.Entries[1].PaymentId.Should().Be(rows[0].PaymentId);
        history.Entries[2].Detail.Should().Be("Online coaching");

        var raw = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        raw.Should().NotContain(ValidIban).And.NotContain("Svobodov");
    }

    [Fact]
    public async Task History_ClientWithoutTerms_IsEmpty()
    {
        var world = await CreateWorldAsync(factory);

        var response = await world.Coach.Http.GetAsync($"{world.Route}/history", TestContext.Current.CancellationToken);

        (await ReadAsync<GetClientPaymentHistoryResponse>(response)).Entries.Should().BeEmpty();
    }

    [Fact]
    public async Task History_OnlyTheCallingCoachSeesTheirOwnEntries()
    {
        var world = await CreateWorldAsync(factory);
        await StartMonthlyAsync(world);
        var secondCoach = await TestActors.Nutritionist(factory).CreateAsync(TestContext.Current.CancellationToken);
        await SubscribeAsync(factory, secondCoach, canUsePayments: true);
        await TestActors.Link(factory, secondCoach, world.Client).AsRole(UserRole.Nutritionist)
            .CreateAsync(TestContext.Current.CancellationToken);

        var response = await secondCoach.Http.GetAsync(
            $"/payments/clients/{world.Client.PublicId}/history", TestContext.Current.CancellationToken);

        (await ReadAsync<GetClientPaymentHistoryResponse>(response)).Entries.Should().BeEmpty();
    }
}
