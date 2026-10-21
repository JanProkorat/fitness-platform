using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FluentAssertions;

namespace FitnessPlatform.Tests.Domain.Services;

/// <summary>
/// The pure half of the client payment schedule: which periods exist, what a period costs, the overdue rule
/// and the Prague day boundary.
/// </summary>
public class ClientPaymentScheduleTests
{
    private static readonly DateOnly Today = new(2026, 10, 21);
    private static long _nextId;

    private static CoachPackage Package(
        PackageBillingInterval billing = PackageBillingInterval.Monthly,
        decimal price = 2500m,
        int? intervalWeeks = null,
        int? runsFor = null) => new()
    {
        Id = ++_nextId,
        Name = "Online coaching",
        Price = price,
        Billing = billing,
        IntervalWeeks = intervalWeeks,
        RunsForPayments = runsFor,
        Prices = [new CoachPackagePrice { Id = ++_nextId, Price = price, EffectiveFromUtc = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc) }]
    };

    private static ClientPaymentTerms Terms(
        CoachPackage package,
        DateOnly effectiveFrom,
        CoachDiscount? discount = null,
        decimal? customPrice = null) => new()
    {
        Id = ++_nextId,
        CoachPackage = package,
        CoachPackageId = package.Id,
        CoachDiscount = discount,
        CoachDiscountId = discount?.Id,
        CustomPrice = customPrice,
        EffectiveFromUtc = ClientPaymentSchedule.StartOfDayUtc(effectiveFrom)
    };

    private static CoachDiscount Discount(
        DiscountType type = DiscountType.Percentage,
        decimal value = 30m,
        DiscountDuration duration = DiscountDuration.EveryPayment,
        int? payments = null,
        DateOnly? validFrom = null,
        DateOnly? validTo = null) => new()
    {
        Id = ++_nextId,
        Name = "Friends & family",
        Type = type,
        Value = value,
        Duration = duration,
        DurationPayments = payments,
        ValidFrom = validFrom,
        ValidTo = validTo
    };

    [Fact]
    public void Zone_IsEuropePrague()
    {
        ClientPaymentSchedule.Zone.Id.Should().Be("Europe/Prague");
    }

    [Theory]
    [InlineData("2026-10-20T21:59:59Z", "2026-10-20")]
    [InlineData("2026-10-20T22:00:00Z", "2026-10-21")]
    [InlineData("2026-12-31T22:59:59Z", "2026-12-31")]
    [InlineData("2026-12-31T23:00:00Z", "2027-01-01")]
    public void Today_FollowsThePragueMidnight(string utc, string expected)
    {
        var instant = DateTime.Parse(utc, null, System.Globalization.DateTimeStyles.AdjustToUniversal);

        ClientPaymentSchedule.Today(instant).Should().Be(DateOnly.Parse(expected));
    }

    [Theory]
    [InlineData("2026-10-20", ClientPaymentStatus.Upcoming, ClientPaymentStatus.Overdue)]
    [InlineData("2026-10-20", ClientPaymentStatus.Requested, ClientPaymentStatus.Overdue)]
    [InlineData("2026-10-21", ClientPaymentStatus.Requested, ClientPaymentStatus.Requested)]
    [InlineData("2026-10-22", ClientPaymentStatus.Upcoming, ClientPaymentStatus.Upcoming)]
    [InlineData("2026-10-01", ClientPaymentStatus.Paid, ClientPaymentStatus.Paid)]
    [InlineData("2026-10-01", ClientPaymentStatus.Waived, ClientPaymentStatus.Waived)]
    public void DerivedStatus_IsOverdueOnlyForUnsettledPaymentsPastTheirDueDate(
        string dueDate, ClientPaymentStatus stored, ClientPaymentStatus expected)
    {
        ClientPaymentSchedule.DerivedStatus(stored, DateOnly.Parse(dueDate), Today).Should().Be(expected);
    }

    [Fact]
    public void PlanMissingPeriods_NoTerms_PlansNothing()
    {
        ClientPaymentSchedule.PlanMissingPeriods([], [], Today).Should().BeEmpty();
    }

    [Fact]
    public void PlanMissingPeriods_FirstTermsStartingToday_PlansThisPeriodAndTheNext()
    {
        var terms = Terms(Package(), Today);

        var planned = ClientPaymentSchedule.PlanMissingPeriods([terms], [], Today);

        planned.Should().Equal(
            (new DateOnly(2026, 10, 21), new DateOnly(2026, 11, 20)),
            (new DateOnly(2026, 11, 21), new DateOnly(2026, 12, 20)));
    }

    [Fact]
    public void PlanMissingPeriods_TermsStartedMonthsAgo_CatchesUpAndAddsTheNextPeriod()
    {
        var terms = Terms(Package(), new DateOnly(2026, 8, 1));

        var planned = ClientPaymentSchedule.PlanMissingPeriods([terms], [], Today);

        planned.Select(p => p.Start).Should().Equal(
            new DateOnly(2026, 8, 1), new DateOnly(2026, 9, 1), new DateOnly(2026, 10, 1), new DateOnly(2026, 11, 1));
        planned[0].End.Should().Be(new DateOnly(2026, 8, 31));
    }

    [Fact]
    public void PlanMissingPeriods_FirstTermsInTheFuture_PlansOnlyThatFirstPeriod()
    {
        var terms = Terms(Package(), new DateOnly(2026, 12, 1));

        ClientPaymentSchedule.PlanMissingPeriods([terms], [], Today)
            .Select(p => p.Start).Should().Equal(new DateOnly(2026, 12, 1));
    }

    [Fact]
    public void PlanMissingPeriods_PeriodsAlreadyCreatedThroughTheNext_PlansNothing()
    {
        var terms = Terms(Package(), new DateOnly(2026, 8, 1));
        var existing = new[] { new DateOnly(2026, 8, 1), new DateOnly(2026, 9, 1), new DateOnly(2026, 10, 1), new DateOnly(2026, 11, 1) };

        ClientPaymentSchedule.PlanMissingPeriods([terms], existing, Today).Should().BeEmpty();
    }

    [Fact]
    public void PlanMissingPeriods_StaleRows_ContinuesFromTheLastOne()
    {
        var terms = Terms(Package(), new DateOnly(2026, 8, 1));
        var existing = new[] { new DateOnly(2026, 8, 1), new DateOnly(2026, 9, 1) };

        ClientPaymentSchedule.PlanMissingPeriods([terms], existing, Today)
            .Select(p => p.Start).Should().Equal(new DateOnly(2026, 10, 1), new DateOnly(2026, 11, 1));
    }

    [Fact]
    public void PlanMissingPeriods_BillingDayThirtyOne_ClampsShortMonthsWithoutDrifting()
    {
        var terms = Terms(Package(), new DateOnly(2026, 1, 31));

        var starts = ClientPaymentSchedule.PlanMissingPeriods([terms], [], new DateOnly(2026, 4, 1))
            .Select(p => p.Start).ToList();

        starts.Should().Equal(
            new DateOnly(2026, 1, 31), new DateOnly(2026, 2, 28), new DateOnly(2026, 3, 31), new DateOnly(2026, 4, 30));
    }

    [Fact]
    public void PlanMissingPeriods_EveryTwoWeeks_StepsFourteenDaysAndCanHaveTwoPeriodsInOneMonth()
    {
        var terms = Terms(Package(PackageBillingInterval.EveryNWeeks, intervalWeeks: 2), new DateOnly(2026, 10, 1));

        var planned = ClientPaymentSchedule.PlanMissingPeriods([terms], [], Today);

        planned.Select(p => p.Start).Should().Equal(
            new DateOnly(2026, 10, 1), new DateOnly(2026, 10, 15), new DateOnly(2026, 10, 29));
        planned[0].End.Should().Be(new DateOnly(2026, 10, 14));
    }

    [Fact]
    public void PlanMissingPeriods_OneOffPackage_PlansOneRowOnly()
    {
        var terms = Terms(Package(PackageBillingInterval.OneOff), Today);

        var first = ClientPaymentSchedule.PlanMissingPeriods([terms], [], Today);
        var again = ClientPaymentSchedule.PlanMissingPeriods([terms], [Today], Today);

        first.Should().Equal((Today, Today));
        again.Should().BeEmpty();
    }

    [Fact]
    public void PlanMissingPeriods_PackageRunsForThreePayments_StopsAfterThree()
    {
        var terms = Terms(Package(runsFor: 3), new DateOnly(2026, 8, 1));

        ClientPaymentSchedule.PlanMissingPeriods([terms], [], Today)
            .Select(p => p.Start).Should().Equal(
                new DateOnly(2026, 8, 1), new DateOnly(2026, 9, 1), new DateOnly(2026, 10, 1));
    }

    [Fact]
    public void PlanMissingPeriods_NewTermsKeepTheChainAndApplyFromTheNextBoundary()
    {
        var first = Terms(Package(), new DateOnly(2026, 9, 1));
        var changed = new ClientPaymentTerms
        {
            Id = ++_nextId,
            CoachPackage = Package(PackageBillingInterval.EveryNWeeks, intervalWeeks: 2),
            EffectiveFromUtc = ClientPaymentSchedule.StartOfDayUtc(Today)
        };
        var existing = new[] { new DateOnly(2026, 9, 1), new DateOnly(2026, 10, 1) };

        var planned = ClientPaymentSchedule.PlanMissingPeriods([first, changed], existing, Today);

        // October ran under the old (monthly) terms, so the next boundary is 1 November, where the new terms start.
        planned.Select(p => p.Start).Should().Equal(new DateOnly(2026, 11, 1));
        planned[0].End.Should().Be(new DateOnly(2026, 11, 14));
    }

    [Fact]
    public void BasePrice_UsesThePriceInForceWhenThePeriodStarts()
    {
        var package = Package(price: 1500m);
        package.Prices.Add(new CoachPackagePrice
        {
            Id = ++_nextId,
            Price = 1800m,
            EffectiveFromUtc = ClientPaymentSchedule.StartOfDayUtc(new DateOnly(2026, 10, 15))
        });
        package.Price = 1800m;
        var terms = Terms(package, new DateOnly(2026, 1, 1));

        ClientPaymentSchedule.BasePrice(terms, new DateOnly(2026, 10, 1)).Should().Be(1500m);
        ClientPaymentSchedule.BasePrice(terms, new DateOnly(2026, 11, 1)).Should().Be(1800m);
    }

    [Fact]
    public void Breakdown_PercentageDiscount_TakesItOffTheBasePrice()
    {
        var terms = Terms(Package(), Today, Discount());

        var breakdown = ClientPaymentSchedule.Breakdown(terms, new DateOnly(2026, 11, 1), 1, new DateOnly(2026, 11, 1));

        breakdown.BasePrice.Should().Be(2500m);
        breakdown.Amount.Should().Be(1750m);
        breakdown.DiscountAmount.Should().Be(750m);
        breakdown.Label.Should().Be("Friends & family −30 %");
        breakdown.IsCustomPrice.Should().BeFalse();
    }

    [Fact]
    public void Breakdown_FixedDiscount_LabelsTheCurrencyAndNeverGoesBelowZero()
    {
        var terms = Terms(Package(price: 100m), Today, Discount(DiscountType.FixedAmount, 250m));

        var breakdown = ClientPaymentSchedule.Breakdown(terms, new DateOnly(2026, 11, 1), 1, new DateOnly(2026, 11, 1));

        breakdown.Amount.Should().Be(0m);
        breakdown.Label.Should().Be("Friends & family −250 Kč");
    }

    [Fact]
    public void Breakdown_CustomPrice_ReplacesThePackagePriceAndTheDiscount()
    {
        var terms = Terms(Package(), Today, customPrice: 1200m);

        var breakdown = ClientPaymentSchedule.Breakdown(terms, new DateOnly(2026, 11, 1), 1, new DateOnly(2026, 11, 1));

        breakdown.Amount.Should().Be(1200m);
        breakdown.BasePrice.Should().Be(2500m);
        breakdown.IsCustomPrice.Should().BeTrue();
    }

    [Theory]
    [InlineData(2, true)]
    [InlineData(3, false)]
    public void Breakdown_FirstPaymentsDiscount_StopsAfterTheCoveredCount(int ordinal, bool discounted)
    {
        var terms = Terms(Package(), Today, Discount(duration: DiscountDuration.FirstPayments, payments: 2));

        var breakdown = ClientPaymentSchedule.Breakdown(terms, new DateOnly(2026, 11, 1), ordinal, new DateOnly(2026, 11, 1));

        breakdown.Amount.Should().Be(discounted ? 1750m : 2500m);
    }

    [Fact]
    public void Breakdown_DueDateOutsideTheDiscountWindow_PaysTheBasePrice()
    {
        var terms = Terms(Package(), Today, Discount(validTo: new DateOnly(2026, 10, 31)));

        ClientPaymentSchedule.Breakdown(terms, new DateOnly(2026, 10, 1), 1, new DateOnly(2026, 10, 1)).Amount.Should().Be(1750m);
        ClientPaymentSchedule.Breakdown(terms, new DateOnly(2026, 11, 1), 2, new DateOnly(2026, 11, 1)).Amount.Should().Be(2500m);
    }

    [Fact]
    public void FiguresOf_FirstPaymentsDiscount_CountsAWaivedRowButNotAOneOff()
    {
        var terms = Terms(Package(), new DateOnly(2026, 9, 1), Discount(duration: DiscountDuration.FirstPayments, payments: 2));
        var september = new ClientPayment { Status = ClientPaymentStatus.Waived, PeriodStart = new DateOnly(2026, 9, 1), DueDate = new DateOnly(2026, 9, 1) };
        var october = new ClientPayment { Status = ClientPaymentStatus.Upcoming, PeriodStart = new DateOnly(2026, 10, 1), DueDate = new DateOnly(2026, 10, 1) };
        var november = new ClientPayment { Status = ClientPaymentStatus.Upcoming, PeriodStart = new DateOnly(2026, 11, 1), DueDate = new DateOnly(2026, 11, 1) };
        var oneOff = new ClientPayment { Kind = ClientPaymentKind.OneOff, Status = ClientPaymentStatus.Upcoming, Amount = 300m, Title = "Workshop", DueDate = new DateOnly(2026, 9, 15) };
        var starts = new[] { september.PeriodStart!.Value, october.PeriodStart!.Value, november.PeriodStart!.Value };

        ClientPaymentSchedule.FiguresOf(october, [terms], starts).Amount.Should().Be(1750m, "October is the second recurring payment, the waived September counts as the first");
        ClientPaymentSchedule.FiguresOf(november, [terms], starts).Amount.Should().Be(2500m, "November is the third");
        ClientPaymentSchedule.FiguresOf(oneOff, [terms], starts).Amount.Should().Be(300m);
    }

    [Fact]
    public void FiguresOf_RequestedPayment_ReturnsTheFrozenValuesNotTheCurrentTerms()
    {
        var terms = Terms(Package(price: 9999m), new DateOnly(2026, 9, 1));
        var frozen = new ClientPayment
        {
            Status = ClientPaymentStatus.Requested,
            PeriodStart = new DateOnly(2026, 10, 1),
            DueDate = new DateOnly(2026, 10, 1),
            Amount = 1750m,
            BasePrice = 2500m,
            DiscountLabel = "Friends & family −30 %",
            PackageName = "Old name"
        };

        var figures = ClientPaymentSchedule.FiguresOf(frozen, [terms], [new DateOnly(2026, 10, 1)]);

        figures.Should().Be((1750m, 2500m, "Friends & family −30 %", "Old name"));
    }

    [Fact]
    public void Freeze_UpcomingPayment_WritesTheCurrentFiguresOntoTheRow()
    {
        var terms = Terms(Package(), new DateOnly(2026, 9, 1), Discount());
        var payment = new ClientPayment { Status = ClientPaymentStatus.Upcoming, PeriodStart = new DateOnly(2026, 10, 1), DueDate = new DateOnly(2026, 10, 1) };

        ClientPaymentSchedule.Freeze(payment, [terms], [new DateOnly(2026, 10, 1)]);

        payment.Amount.Should().Be(1750m);
        payment.BasePrice.Should().Be(2500m);
        payment.PackageName.Should().Be("Online coaching");
        payment.DiscountLabel.Should().Contain("30");
    }
}
