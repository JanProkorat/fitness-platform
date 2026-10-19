using System.Globalization;
using FitnessPlatform.Application.Infrastructure.Services;
using FluentAssertions;

namespace FitnessPlatform.Tests.Infrastructure.Services;

/// <summary>Unit tests for <see cref="UnverifiedAccountCleanupService.NextRunUtc"/>.</summary>
public class UnverifiedAccountCleanupScheduleTests
{
    private static readonly TimeZoneInfo Prague = TimeZoneInfo.FindSystemTimeZoneById("Europe/Prague");

    private static readonly TimeOnly OneAm = new(1, 0);

    private static DateTimeOffset Utc(string iso) =>
        DateTimeOffset.Parse(iso, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal);

    [Theory]
    [InlineData("2026-10-17T22:00:00Z", "2026-10-17T23:00:00Z")] // Sunday 00:00 local, before the slot
    [InlineData("2026-10-17T23:00:00Z", "2026-10-24T23:00:00Z")] // exactly at the slot: next week
    [InlineData("2026-10-18T10:00:00Z", "2026-10-24T23:00:00Z")] // Sunday after the slot
    [InlineData("2026-10-21T12:00:00Z", "2026-10-24T23:00:00Z")] // mid-week
    public void NextRunUtc_SundayAtOne_ReturnsNextSlot(string now, string expected)
    {
        UnverifiedAccountCleanupService.NextRunUtc(Utc(now), DayOfWeek.Sunday, OneAm, Prague)
            .Should().Be(Utc(expected));
    }

    [Fact]
    public void NextRunUtc_SpringForward_UsesWinterOffsetBeforeAndSummerOffsetAfter()
    {
        var beforeChange = UnverifiedAccountCleanupService.NextRunUtc(
            Utc("2026-03-25T12:00:00Z"), DayOfWeek.Sunday, OneAm, Prague);
        var afterChange = UnverifiedAccountCleanupService.NextRunUtc(beforeChange, DayOfWeek.Sunday, OneAm, Prague);

        beforeChange.Should().Be(Utc("2026-03-29T00:00:00Z")); // 01:00 CET
        afterChange.Should().Be(Utc("2026-04-04T23:00:00Z")); // 01:00 CEST
    }

    [Fact]
    public void NextRunUtc_FallBack_UsesSummerOffsetBeforeAndWinterOffsetAfter()
    {
        var beforeChange = UnverifiedAccountCleanupService.NextRunUtc(
            Utc("2026-10-21T12:00:00Z"), DayOfWeek.Sunday, OneAm, Prague);
        var afterChange = UnverifiedAccountCleanupService.NextRunUtc(beforeChange, DayOfWeek.Sunday, OneAm, Prague);

        beforeChange.Should().Be(Utc("2026-10-24T23:00:00Z")); // 01:00 CEST
        afterChange.Should().Be(Utc("2026-11-01T00:00:00Z")); // 01:00 CET
    }

    [Fact]
    public void NextRunUtc_TimeInSpringGap_MovesOneHourForward()
    {
        UnverifiedAccountCleanupService.NextRunUtc(
                Utc("2026-03-25T12:00:00Z"), DayOfWeek.Sunday, new TimeOnly(2, 30), Prague)
            .Should().Be(Utc("2026-03-29T01:30:00Z")); // 03:30 CEST
    }

    [Fact]
    public void NextRunUtc_AmbiguousTimeInFallBack_UsesFirstOccurrence()
    {
        UnverifiedAccountCleanupService.NextRunUtc(
                Utc("2026-10-21T12:00:00Z"), DayOfWeek.Sunday, new TimeOnly(2, 30), Prague)
            .Should().Be(Utc("2026-10-25T00:30:00Z")); // 02:30 CEST
    }
}
