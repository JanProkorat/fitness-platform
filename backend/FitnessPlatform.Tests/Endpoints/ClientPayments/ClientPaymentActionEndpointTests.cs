using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientPayments.Shared;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using static FitnessPlatform.Tests.Endpoints.ClientPayments.ClientPaymentFixtures;
using static FitnessPlatform.Tests.Endpoints.PaymentSettings.PaymentSettingsFixtures;

namespace FitnessPlatform.Tests.Endpoints.ClientPayments;

/// <summary>
/// Integration tests for adding a one-off payment, marking a payment paid and waiving it.
/// </summary>
[Collection(TestCollection.Name)]
public class ClientPaymentActionEndpointTests(FitnessApiFactory factory)
{
    private static object OneOffBody(decimal amount = 300m, string title = "Workshop") => new
    {
        Title = title,
        Amount = amount,
        DueDate = Today.AddDays(10)
    };

    [Fact]
    public async Task AddOneOff_InTheMonthOfARecurringPayment_Returns201WithAnUpcomingRowAndItsOwnVariableSymbol()
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world);
        var month = rows[0].PeriodStart!.Value;

        var response = await world.Coach.Http.PostAsJsonAsync(
            $"{world.Route}/one-off", new { Title = "Workshop", Amount = 300m, DueDate = month }, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var payment = await ReadAsync<ClientPaymentRowDto>(response);
        payment.Kind.Should().Be(ClientPaymentKind.OneOff);
        payment.Status.Should().Be(ClientPaymentStatus.Upcoming);
        payment.Amount.Should().Be(300m);
        payment.Title.Should().Be("Workshop");
        payment.PeriodStart.Should().BeNull();
        payment.VariableSymbol.Should().MatchRegex("^[0-9]{10}$")
            .And.StartWith($"{month.Year}{month.Month:D2}")
            .And.NotBe(rows[0].VariableSymbol, "the recurring payment of that month already holds the preferred symbol");
        (await ListAsync(world)).Should().ContainSingle(p => p.PaymentId == payment.PaymentId);
    }

    [Fact]
    public async Task AddOneOff_AmountOutsideTheRange_Returns400()
    {
        var world = await CreateWorldAsync(factory);

        var response = await world.Coach.Http.PostAsJsonAsync(
            $"{world.Route}/one-off", OneOffBody(amount: 0m), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task AddOneOff_ThenRecurringRows_OneOffIsNotCountedForFirstPaymentsDiscounts()
    {
        var world = await CreateWorldAsync(factory);
        var discountId = await CreateDiscountAsync(world.Coach, 50m, "FirstPayments", 1);
        var packageId = await CreatePackageAsync(world.Coach, 2000m);
        (await world.Coach.Http.PostAsJsonAsync($"{world.Route}/one-off", OneOffBody(), TestContext.Current.CancellationToken))
            .StatusCode.Should().Be(HttpStatusCode.Created);

        await SetTermsOkAsync(world, packageId, discountId);

        var recurring = (await ListAsync(world)).Where(p => p.Kind == ClientPaymentKind.Recurring).OrderBy(p => p.PeriodStart).ToList();
        recurring[0].Amount.Should().Be(1000m, "the one-off payment is not the client's first payment");
        recurring[1].Amount.Should().Be(2000m);
    }

    [Fact]
    public async Task MarkPaid_TakesTodayOrTheGivenEarlierDayAndFreezesTheAmount()
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world, 2500m);
        var earlier = Today.AddDays(-4);

        var byDefault = await PostActionAsync(world, rows[0].PaymentId, "mark-paid");
        var withDate = await PostActionAsync(world, rows[1].PaymentId, "mark-paid", new { PaidOn = earlier });

        byDefault.StatusCode.Should().Be(HttpStatusCode.OK);
        var payment = await ReadAsync<ClientPaymentRowDto>(byDefault);
        payment.Status.Should().Be(ClientPaymentStatus.Paid);
        payment.PaidOn.Should().Be(Today);
        payment.Amount.Should().Be(2500m);
        (await ReadAsync<ClientPaymentRowDto>(withDate)).PaidOn.Should().Be(earlier);

        // A later price change must not rewrite what was paid.
        var cheaper = await CreatePackageAsync(world.Coach, 100m, "Cheap");
        await SetTermsOkAsync(world, cheaper);
        (await ListAsync(world)).Where(p => p.Status == ClientPaymentStatus.Paid).Should().HaveCount(2)
            .And.OnlyContain(p => p.Amount == 2500m);
    }

    [Fact]
    public async Task MarkPaid_WithAFuturePaidOn_Returns400()
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world);

        var response = await PostActionAsync(world, rows[0].PaymentId, "mark-paid", new { PaidOn = Today.AddDays(5) });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await ReadStoredAsync(factory, rows[0].PaymentId)).Status.Should().Be(ClientPaymentStatus.Upcoming);
    }

    [Fact]
    public async Task Waive_UpcomingOrRequestedPayment_ZeroesItReleasesTheSymbolAndKeepsTheReason()
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world);
        (await PostActionAsync(world, rows[1].PaymentId, "request", new { SendEmail = true })).StatusCode.Should().Be(HttpStatusCode.OK);

        var upcoming = await PostActionAsync(world, rows[0].PaymentId, "waive", new { Reason = "  Holiday  " });
        var requested = await PostActionAsync(world, rows[1].PaymentId, "waive");

        upcoming.StatusCode.Should().Be(HttpStatusCode.OK);
        var payment = await ReadAsync<ClientPaymentRowDto>(upcoming);
        payment.Status.Should().Be(ClientPaymentStatus.Waived);
        payment.Amount.Should().Be(0m);
        payment.VariableSymbol.Should().BeNull();
        payment.WaiveReason.Should().Be("Holiday");
        requested.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ReadAsync<ClientPaymentRowDto>(requested)).Status.Should().Be(ClientPaymentStatus.Waived);
    }

    [Fact]
    public async Task Waive_ReasonOverOneHundredCharacters_Returns400()
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world);

        var response = await PostActionAsync(world, rows[0].PaymentId, "waive", new { Reason = new string('x', 101) });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Actions_OnAPaidOrWaivedPayment_Return409WithTheSettledState()
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world);
        (await PostActionAsync(world, rows[0].PaymentId, "mark-paid")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await PostActionAsync(world, rows[1].PaymentId, "waive")).StatusCode.Should().Be(HttpStatusCode.OK);

        foreach (var (paymentId, code) in new[] { (rows[0].PaymentId, "PAYMENT_ALREADY_PAID"), (rows[1].PaymentId, "PAYMENT_ALREADY_WAIVED") })
        {
            foreach (var action in new[] { "mark-paid", "waive", "request" })
            {
                var response = await PostActionAsync(world, paymentId, action, new { SendEmail = true });

                response.StatusCode.Should().Be(HttpStatusCode.Conflict, $"{action} on {code}");
                (await ProblemCodeAsync(response)).Should().Be(code, action);
            }
        }

        Email(factory).SentPaymentRequests.Should().NotContain(e => e.ToEmail == world.Client.Email);
    }

    [Fact]
    public async Task Waive_FirstPaymentsDiscount_WaivedRowStillCountsAsAPayment()
    {
        var world = await CreateWorldAsync(factory);
        var discountId = await CreateDiscountAsync(world.Coach, 50m, "FirstPayments", 1);
        var rows = await StartMonthlyAsync(world, 2000m, discountId);
        rows[0].Amount.Should().Be(1000m);
        rows[1].Amount.Should().Be(2000m, "only the first recurring payment is discounted");

        (await PostActionAsync(world, rows[0].PaymentId, "waive")).StatusCode.Should().Be(HttpStatusCode.OK);

        var after = (await ListAsync(world)).OrderBy(p => p.PeriodStart).ToList();
        after[0].Status.Should().Be(ClientPaymentStatus.Waived);
        after[1].Amount.Should().Be(2000m, "the waived payment keeps its place, so the next one is not the client's first");
    }

    [Fact]
    public async Task Writes_AreAuditedUnderTheAssignmentWithoutPersonalData()
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world);
        await PostActionAsync(world, rows[0].PaymentId, "mark-paid");
        await PostActionAsync(world, rows[1].PaymentId, "request", new { SendEmail = true, SendNotification = true });

        var audit = await ReadAuditAsync(world);

        audit.Select(a => a.Action).Should().Equal("SetClientPaymentTerms", "MarkClientPaymentPaid", "RequestClientPayment");
        audit.Should().OnlyContain(a => a.UserId == world.Coach.UserId && a.EntityType == "ClientPaymentAssignment");
        audit.Should().OnlyContain(a => a.Action.Length <= 50 && (a.NewValues ?? string.Empty).Length <= 500);
        audit.Should().OnlyContain(a =>
            !(a.NewValues ?? string.Empty).Contains(ValidIban)
            && !(a.NewValues ?? string.Empty).Contains("Eva")
            && !(a.NewValues ?? string.Empty).Contains("Svobodov"));
        audit[0].NewValues.Should().Contain("Online coaching");
        audit[2].NewValues.Should().Contain(rows[1].PaymentId.ToString()).And.Contain("email,notification");
    }
}
