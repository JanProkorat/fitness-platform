using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Services;
using FluentAssertions;

namespace FitnessPlatform.Tests.Domain.Services;

/// <summary>
/// Unit tests for <see cref="CoachPackagePricing.ResolvePrice"/>.
/// </summary>
public class CoachPackagePricingTests
{
    private static readonly DateTime Changed = new(2026, 11, 10, 12, 0, 0, DateTimeKind.Utc);

    private static List<CoachPackagePrice> History() =>
    [
        new() { Price = 1500m, EffectiveFromUtc = Changed.AddDays(-60) },
        new() { Price = 1800m, EffectiveFromUtc = Changed }
    ];

    [Fact]
    public void ResolvePrice_PeriodStartedBeforeChange_KeepsOldPrice()
    {
        CoachPackagePricing.ResolvePrice(History(), Changed.AddSeconds(-1)).Should().Be(1500m);
    }

    [Fact]
    public void ResolvePrice_PeriodStartsExactlyAtChange_UsesNewPrice()
    {
        CoachPackagePricing.ResolvePrice(History(), Changed).Should().Be(1800m);
    }

    [Fact]
    public void ResolvePrice_PeriodStartsAfterChange_UsesNewPrice()
    {
        CoachPackagePricing.ResolvePrice(History(), Changed.AddDays(30)).Should().Be(1800m);
    }

    [Fact]
    public void ResolvePrice_PeriodStartsBeforeFirstRow_ReturnsNull()
    {
        CoachPackagePricing.ResolvePrice(History(), Changed.AddDays(-90)).Should().BeNull();
    }
}
