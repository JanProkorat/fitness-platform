using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FluentAssertions;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Tests for <see cref="PendingInviteStatusResolver"/>: expiry is derived from the stored status
/// and the send time, never stored.
/// </summary>
public class PendingInviteStatusResolverTests
{
    private static readonly DateTime Now = new(2026, 10, 20, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Resolve_PendingWithinWindow_StaysPending()
    {
        PendingInviteStatusResolver.Resolve(PendingInviteStatus.Pending, Now.AddDays(-6), Now)
            .Should().Be(PendingInviteStatus.Pending);
    }

    [Fact]
    public void Resolve_PendingExactlyAtWindowEdge_StaysPending()
    {
        PendingInviteStatusResolver.Resolve(PendingInviteStatus.Pending, Now.AddDays(-7), Now)
            .Should().Be(PendingInviteStatus.Pending);
    }

    [Fact]
    public void Resolve_PendingPastWindow_IsExpired()
    {
        PendingInviteStatusResolver.Resolve(PendingInviteStatus.Pending, Now.AddDays(-7).AddSeconds(-1), Now)
            .Should().Be(PendingInviteStatus.Expired);
    }

    [Theory]
    [InlineData(PendingInviteStatus.Accepted)]
    [InlineData(PendingInviteStatus.Declined)]
    [InlineData(PendingInviteStatus.Cancelled)]
    public void Resolve_AnsweredInvite_KeepsStoredStatusEvenWhenOld(PendingInviteStatus stored)
    {
        PendingInviteStatusResolver.Resolve(stored, Now.AddDays(-30), Now).Should().Be(stored);
    }

    [Fact]
    public void ExpiresAt_IsSevenDaysAfterSend()
    {
        PendingInviteStatusResolver.ExpiresAt(Now).Should().Be(Now.AddDays(7));
    }
}
