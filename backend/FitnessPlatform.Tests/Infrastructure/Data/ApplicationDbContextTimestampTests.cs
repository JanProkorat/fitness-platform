using FitnessPlatform.Application.Infrastructure.Data;
using FluentAssertions;

namespace FitnessPlatform.Tests.Infrastructure.Data;

/// <summary>
/// Unit tests for <see cref="ApplicationDbContext.NextDateCreated"/> — the tie-breaking
/// helper that keeps DateCreated strictly increasing at whole-microsecond precision.
/// </summary>
public class ApplicationDbContextTimestampTests
{
    [Fact]
    public void NextDateCreated_SubMicrosecondGapAfterPrevious_ReturnsPreviousPlusOneMicrosecond()
    {
        var previous = new DateTime(2026, 9, 30, 12, 0, 0, DateTimeKind.Utc).AddTicks(10 * TimeSpan.TicksPerMicrosecond);
        var candidate = previous.AddTicks(3);

        var result = ApplicationDbContext.NextDateCreated(candidate, previous);

        result.Should().Be(previous.AddTicks(TimeSpan.TicksPerMicrosecond));
    }

    [Fact]
    public void NextDateCreated_ExactTie_ReturnsPreviousPlusOneMicrosecond()
    {
        var previous = new DateTime(2026, 9, 30, 12, 0, 0, DateTimeKind.Utc).AddTicks(10 * TimeSpan.TicksPerMicrosecond);

        var result = ApplicationDbContext.NextDateCreated(previous, previous);

        result.Should().Be(previous.AddTicks(TimeSpan.TicksPerMicrosecond));
    }

    [Fact]
    public void NextDateCreated_LaterCandidate_ReturnsTruncatedCandidate()
    {
        var previous = new DateTime(2026, 9, 30, 12, 0, 0, DateTimeKind.Utc).AddTicks(10 * TimeSpan.TicksPerMicrosecond);
        var candidate = previous.AddTicks(5 * TimeSpan.TicksPerMicrosecond + 7);

        var result = ApplicationDbContext.NextDateCreated(candidate, previous);

        result.Should().Be(previous.AddTicks(5 * TimeSpan.TicksPerMicrosecond));
        (result.Ticks % TimeSpan.TicksPerMicrosecond).Should().Be(0);
    }
}
