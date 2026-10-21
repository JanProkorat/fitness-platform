using System.Net;
using System.Net.Http.Json;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientPayments.Shared;
using FitnessPlatform.Tests.Builders;
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
    public async Task AddOneOff_ValidBody_Returns201WithAnUpcomingRowAndAVariableSymbol()
    {
        var world = await CreateWorldAsync(factory);

        var response = await world.Coach.Http.PostAsJsonAsync($"{world.Route}/one-off", OneOffBody(), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var payment = await ReadAsync<ClientPaymentRowDto>(response);
        payment.Kind.Should().Be(ClientPaymentKind.OneOff);
        payment.Status.Should().Be(ClientPaymentStatus.Upcoming);
        payment.Amount.Should().Be(300m);
        payment.Title.Should().Be("Workshop");
        payment.PeriodStart.Should().BeNull();
        payment.VariableSymbol.Should().MatchRegex("^[0-9]{10}$");
        (await ListAsync(world)).Should().ContainSingle(p => p.PaymentId == payment.PaymentId);
    }

    [Fact]
    public async Task AddOneOff_InTheSameMonthAsARecurringPayment_GetsAnotherVariableSymbol()
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world);
        var body = new { Title = "Workshop", Amount = 300m, DueDate = rows[0].PeriodStart!.Value };

        var response = await world.Coach.Http.PostAsJsonAsync($"{world.Route}/one-off", body, TestContext.Current.CancellationToken);

        var payment = await ReadAsync<ClientPaymentRowDto>(response);
        payment.VariableSymbol.Should().NotBe(rows[0].VariableSymbol);
        payment.VariableSymbol.Should().StartWith($"{rows[0].PeriodStart!.Value.Year}{rows[0].PeriodStart!.Value.Month:D2}");
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
    public async Task AddOneOff_ClientOfAnotherCoach_Returns404()
    {
        var world = await CreateWorldAsync(factory);
        var other = await CreateWorldAsync(factory);

        var response = await world.Coach.Http.PostAsJsonAsync(
            $"/payments/clients/{other.Client.PublicId}/one-off", OneOffBody(), TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
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
    public async Task MarkPaid_UpcomingPayment_FreezesTheAmountAndDefaultsPaidOnToToday()
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world, 2500m);

        var response = await PostActionAsync(world, rows[0].PaymentId, "mark-paid");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var payment = await ReadAsync<ClientPaymentRowDto>(response);
        payment.Status.Should().Be(ClientPaymentStatus.Paid);
        payment.PaidOn.Should().Be(Today);
        payment.Amount.Should().Be(2500m);

        // A later price change must not rewrite what was paid.
        var cheaper = await CreatePackageAsync(world.Coach, 100m, "Cheap");
        await SetTermsOkAsync(world, cheaper);
        (await ListAsync(world)).Single(p => p.PaymentId == rows[0].PaymentId).Amount.Should().Be(2500m);
    }

    [Fact]
    public async Task MarkPaid_WithAnEarlierPaidOn_StoresIt()
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world);
        var paidOn = Today.AddDays(-4);

        var response = await PostActionAsync(world, rows[0].PaymentId, "mark-paid", new { PaidOn = paidOn });

        (await ReadAsync<ClientPaymentRowDto>(response)).PaidOn.Should().Be(paidOn);
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
    public async Task MarkPaid_AlreadyPaid_Returns409()
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world);
        await PostActionAsync(world, rows[0].PaymentId, "mark-paid");

        var response = await PostActionAsync(world, rows[0].PaymentId, "mark-paid");

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(response)).Should().Be("PAYMENT_ALREADY_PAID");
    }

    [Fact]
    public async Task MarkPaid_WaivedPayment_Returns409()
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world);
        await PostActionAsync(world, rows[0].PaymentId, "waive");

        var response = await PostActionAsync(world, rows[0].PaymentId, "mark-paid");

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(response)).Should().Be("PAYMENT_ALREADY_WAIVED");
    }

    [Fact]
    public async Task MarkPaid_PaymentOfAnotherCoach_Returns404()
    {
        var world = await CreateWorldAsync(factory);
        var other = await CreateWorldAsync(factory);
        var foreignRows = await StartMonthlyAsync(other);

        var response = await world.Coach.Http.PostAsJsonAsync(
            $"{world.Route}/payments/{foreignRows[0].PaymentId}/mark-paid", new { }, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await ReadStoredAsync(factory, foreignRows[0].PaymentId)).Status.Should().Be(ClientPaymentStatus.Upcoming);
    }

    [Fact]
    public async Task MarkPaid_PaymentOfAnotherClientOfTheSameCoach_Returns404()
    {
        var world = await CreateWorldAsync(factory);
        var other = world with { Client = await AddClientAsync(world) };
        var otherRows = await StartMonthlyAsync(other);

        var response = await PostActionAsync(world, otherRows[0].PaymentId, "mark-paid");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Waive_UpcomingPayment_ZeroesItReleasesTheSymbolAndKeepsTheReason()
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world);

        var response = await PostActionAsync(world, rows[0].PaymentId, "waive", new { Reason = "  Holiday  " });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var payment = await ReadAsync<ClientPaymentRowDto>(response);
        payment.Status.Should().Be(ClientPaymentStatus.Waived);
        payment.Amount.Should().Be(0m);
        payment.VariableSymbol.Should().BeNull();
        payment.WaiveReason.Should().Be("Holiday");
    }

    [Fact]
    public async Task Waive_RequestedPayment_IsAllowed()
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world);
        (await PostActionAsync(world, rows[0].PaymentId, "request", new { SendEmail = true })).StatusCode.Should().Be(HttpStatusCode.OK);

        var response = await PostActionAsync(world, rows[0].PaymentId, "waive");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Waive_PaidPayment_Returns409()
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world);
        await PostActionAsync(world, rows[0].PaymentId, "mark-paid");

        var response = await PostActionAsync(world, rows[0].PaymentId, "waive");

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(response)).Should().Be("PAYMENT_ALREADY_PAID");
    }

    [Fact]
    public async Task Waive_AlreadyWaived_Returns409()
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world);
        await PostActionAsync(world, rows[0].PaymentId, "waive");

        var response = await PostActionAsync(world, rows[0].PaymentId, "waive");

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(response)).Should().Be("PAYMENT_ALREADY_WAIVED");
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
    public async Task Waive_PaymentOfAnotherCoach_Returns404()
    {
        var world = await CreateWorldAsync(factory);
        var other = await CreateWorldAsync(factory);
        var foreignRows = await StartMonthlyAsync(other);

        var response = await world.Coach.Http.PostAsJsonAsync(
            $"{world.Route}/payments/{foreignRows[0].PaymentId}/waive", new { }, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
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
    public async Task Actions_CoachWhoseLastCoachRoleWasRemoved_AreRefused()
    {
        var coach = await TestActors.Trainer(factory).WithRemovedCoachRoles(UserRole.Trainer)
            .CreateAsync(TestContext.Current.CancellationToken);
        await SubscribeAsync(factory, coach, canUsePayments: true);
        var client = await TestActors.Client(factory).CreateAsync(TestContext.Current.CancellationToken);
        await TestActors.Link(factory, coach, client).CreateAsync(TestContext.Current.CancellationToken);
        var paymentId = Guid.NewGuid();

        foreach (var action in new[] { "mark-paid", "waive", "request" })
        {
            var response = await coach.Http.PostAsJsonAsync(
                $"/payments/clients/{client.PublicId}/payments/{paymentId}/{action}", new { SendEmail = true }, TestContext.Current.CancellationToken);

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden, action);
        }

        var oneOff = await coach.Http.PostAsJsonAsync(
            $"/payments/clients/{client.PublicId}/one-off", OneOffBody(), TestContext.Current.CancellationToken);
        oneOff.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Actions_CoachBelowThePaymentsTier_Return403()
    {
        var world = await CreateWorldAsync(factory, entitled: false);

        var markPaid = await PostActionAsync(world, Guid.NewGuid(), "mark-paid");
        var oneOff = await world.Coach.Http.PostAsJsonAsync($"{world.Route}/one-off", OneOffBody(), TestContext.Current.CancellationToken);

        markPaid.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        oneOff.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await ProblemCodeAsync(oneOff)).Should().Be("PAYMENTS_NOT_ENTITLED");
    }

    [Fact]
    public async Task Actions_AreAuditedUnderTheAssignmentWithoutPersonalData()
    {
        var world = await CreateWorldAsync(factory);
        var rows = await StartMonthlyAsync(world);
        await PostActionAsync(world, rows[0].PaymentId, "mark-paid");
        await PostActionAsync(world, rows[1].PaymentId, "request", new { SendEmail = true });

        var audit = await ReadAuditAsync(world);

        audit.Select(a => a.Action).Should().Equal("SetClientPaymentTerms", "MarkClientPaymentPaid", "RequestClientPayment");
        audit.Should().OnlyContain(a => a.UserId == world.Coach.UserId);
        audit.Should().OnlyContain(a => a.Action.Length <= 50 && (a.NewValues ?? string.Empty).Length <= 500);
        audit.Should().OnlyContain(a =>
            !(a.NewValues ?? string.Empty).Contains(ValidIban)
            && !(a.NewValues ?? string.Empty).Contains("Eva")
            && !(a.NewValues ?? string.Empty).Contains("Svobodov"));
    }
}
