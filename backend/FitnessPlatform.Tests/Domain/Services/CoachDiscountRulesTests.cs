using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FluentAssertions;

namespace FitnessPlatform.Tests.Domain.Services;

/// <summary>
/// Unit tests for <see cref="CoachDiscountRules"/>.
/// </summary>
public class CoachDiscountRulesTests
{
    private static readonly DateOnly From = new(2026, 11, 1);
    private static readonly DateOnly To = new(2026, 11, 30);

    private static CoachDiscount Discount(
        DiscountType type = DiscountType.Percentage,
        decimal value = 10m,
        DateOnly? validFrom = null,
        DateOnly? validTo = null,
        DiscountDuration duration = DiscountDuration.EveryPayment,
        int? durationPayments = null) => new()
    {
        Name = "Test",
        Type = type,
        Value = value,
        ValidFrom = validFrom,
        ValidTo = validTo,
        Duration = duration,
        DurationPayments = durationPayments
    };

    [Theory]
    [InlineData("2026-10-31", false)]
    [InlineData("2026-11-01", true)]
    [InlineData("2026-11-30", true)]
    [InlineData("2026-12-01", false)]
    public void Applies_DueDateAgainstWindow_IsInclusiveOnBothEnds(string dueDate, bool expected)
    {
        var discount = Discount(validFrom: From, validTo: To);

        CoachDiscountRules.Applies(discount, 1, DateOnly.Parse(dueDate)).Should().Be(expected);
    }

    [Fact]
    public void Applies_OpenEndedValidTo_AppliesIndefinitely()
    {
        var discount = Discount(validFrom: From);

        CoachDiscountRules.Applies(discount, 1, new DateOnly(2040, 1, 1)).Should().BeTrue();
    }

    [Theory]
    [InlineData(3, true)]
    [InlineData(4, false)]
    public void Applies_FirstPayments_AppliesUpToOrdinalNOnly(int ordinal, bool expected)
    {
        var discount = Discount(duration: DiscountDuration.FirstPayments, durationPayments: 3);

        CoachDiscountRules.Applies(discount, ordinal, From).Should().Be(expected);
    }

    [Fact]
    public void Applies_ArchivedDiscount_NeverApplies()
    {
        var discount = Discount();
        discount.ArchivedAt = DateTime.UtcNow;

        CoachDiscountRules.Applies(discount, 1, From).Should().BeFalse();
    }

    [Fact]
    public void Apply_Percentage_TakesPercentOffAndRounds()
    {
        CoachDiscountRules.Apply(Discount(value: 15m), 999m).Should().Be(849.15m);
    }

    [Fact]
    public void Apply_FixedAmountLargerThanPrice_ClampsToZero()
    {
        CoachDiscountRules.Apply(Discount(DiscountType.FixedAmount, 2000m), 1500m).Should().Be(0m);
    }

    [Fact]
    public void Apply_FixedAmount_TakesAmountOff()
    {
        CoachDiscountRules.Apply(Discount(DiscountType.FixedAmount, 200m), 1500m).Should().Be(1300m);
    }
}
