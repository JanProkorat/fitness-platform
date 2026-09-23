using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FluentAssertions;

namespace FitnessPlatform.Tests.Domain.Services;

/// <summary>
/// Unit tests for <see cref="ClientRosterFilterClassifier"/> — the shared filter-chip matcher
/// and count computation the trainer's clients list and the inbox's conversation filter both
/// classify against.
/// </summary>
public class ClientRosterFilterClassifierTests
{
    private sealed record Facts(
        bool HasUnreadMessages,
        bool HasNoMessages,
        bool HasNewCheckIn,
        bool HasMissingCheckIn,
        bool IsEndingSoon);

    private static bool Matches(ClientListFilter? filter, Facts facts) =>
        ClientRosterFilterClassifier.Matches(
            filter, facts.HasUnreadMessages, facts.HasNoMessages, facts.HasNewCheckIn,
            facts.HasMissingCheckIn, facts.IsEndingSoon);

    [Fact]
    public void Matches_NullFilter_AlwaysTrue()
    {
        Matches(null, new Facts(false, false, false, false, false)).Should().BeTrue();
    }

    [Fact]
    public void Matches_All_AlwaysTrue()
    {
        Matches(ClientListFilter.All, new Facts(false, false, false, false, false)).Should().BeTrue();
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void Matches_UnreadMessages_ReflectsFact(bool hasUnread)
    {
        Matches(ClientListFilter.UnreadMessages, new Facts(hasUnread, false, false, false, false))
            .Should().Be(hasUnread);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void Matches_NoMessages_ReflectsFact(bool hasNoMessages)
    {
        Matches(ClientListFilter.NoMessages, new Facts(false, hasNoMessages, false, false, false))
            .Should().Be(hasNoMessages);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void Matches_NewCheckIns_ReflectsFact(bool hasNewCheckIn)
    {
        Matches(ClientListFilter.NewCheckIns, new Facts(false, false, hasNewCheckIn, false, false))
            .Should().Be(hasNewCheckIn);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void Matches_MissingCheckIns_ReflectsFact(bool hasMissingCheckIn)
    {
        Matches(ClientListFilter.MissingCheckIns, new Facts(false, false, false, hasMissingCheckIn, false))
            .Should().Be(hasMissingCheckIn);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void Matches_EndingSoon_ReflectsFact(bool isEndingSoon)
    {
        Matches(ClientListFilter.EndingSoon, new Facts(false, false, false, false, isEndingSoon))
            .Should().Be(isEndingSoon);
    }

    [Fact]
    public void Matches_FilterChecksOnlyItsOwnFact_IgnoresOtherFactsBeingTrue()
    {
        // A row could plausibly satisfy several chips at once (unread AND ending soon); the
        // requested chip must only look at its own fact, never OR across all of them.
        var facts = new Facts(HasUnreadMessages: true, HasNoMessages: false, HasNewCheckIn: true,
            HasMissingCheckIn: true, IsEndingSoon: true);

        Matches(ClientListFilter.NoMessages, facts).Should().BeFalse(
            "NoMessages must not match just because other chips' facts are true");
    }

    [Fact]
    public void ComputeCounts_MixedRoster_CountsEachChipIndependently()
    {
        var rows = new[]
        {
            new Facts(HasUnreadMessages: true, HasNoMessages: false, HasNewCheckIn: false, HasMissingCheckIn: false, IsEndingSoon: false),
            new Facts(HasUnreadMessages: false, HasNoMessages: true, HasNewCheckIn: false, HasMissingCheckIn: false, IsEndingSoon: false),
            new Facts(HasUnreadMessages: false, HasNoMessages: false, HasNewCheckIn: true, HasMissingCheckIn: true, IsEndingSoon: false),
            new Facts(HasUnreadMessages: false, HasNoMessages: false, HasNewCheckIn: false, HasMissingCheckIn: false, IsEndingSoon: true),
        };

        var counts = ClientRosterFilterClassifier.ComputeCounts(
            rows,
            r => r.HasUnreadMessages,
            r => r.HasNoMessages,
            r => r.HasNewCheckIn,
            r => r.HasMissingCheckIn,
            r => r.IsEndingSoon);

        counts.All.Should().Be(4);
        counts.UnreadMessages.Should().Be(1);
        counts.NoMessages.Should().Be(1);
        counts.NewCheckIns.Should().Be(1);
        counts.MissingCheckIns.Should().Be(1);
        counts.EndingSoon.Should().Be(1);
    }

    [Fact]
    public void ComputeCounts_EmptyRoster_AllZero()
    {
        var counts = ClientRosterFilterClassifier.ComputeCounts(
            Array.Empty<Facts>(),
            r => r.HasUnreadMessages,
            r => r.HasNoMessages,
            r => r.HasNewCheckIn,
            r => r.HasMissingCheckIn,
            r => r.IsEndingSoon);

        counts.All.Should().Be(0);
        counts.UnreadMessages.Should().Be(0);
        counts.NoMessages.Should().Be(0);
        counts.NewCheckIns.Should().Be(0);
        counts.MissingCheckIns.Should().Be(0);
        counts.EndingSoon.Should().Be(0);
    }
}
