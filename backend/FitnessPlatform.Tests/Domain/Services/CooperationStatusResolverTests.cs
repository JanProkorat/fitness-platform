using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.Messaging;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace FitnessPlatform.Tests.Domain.Services;

/// <summary>
/// <see cref="CooperationStatusResolver"/> against a real database: status mapping, expiry at a
/// pinned clock, and ids that match no row.
/// </summary>
[Collection(TestCollection.Name)]
public class CooperationStatusResolverTests(FitnessApiFactory factory)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private async Task<Dictionary<Guid, CooperationSourceState>> ResolveAsync(DateTime now, params Guid[] ids)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await CooperationStatusResolver.ResolveAsync(db, ids, now, Ct);
    }

    [Fact]
    public async Task EmptyIds_ReturnEmpty()
    {
        (await ResolveAsync(DateTime.UtcNow)).Should().BeEmpty();
    }

    [Fact]
    public async Task UnknownId_IsAbsent()
    {
        (await ResolveAsync(DateTime.UtcNow, Guid.NewGuid())).Should().BeEmpty();
    }

    [Fact]
    public async Task PendingInvite_ExpiresAtPinnedClock_AndCarriesScope()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var sentAt = DateTime.UtcNow;
        var inviteId = await ConversationListSeed.SeedInviteAsync(
            factory, coach, client, scope: LinkCapabilityScope.TrainingOnly, sentAt: sentAt, appendEvent: false);

        var fresh = await ResolveAsync(sentAt.AddDays(6), inviteId);
        var stale = await ResolveAsync(sentAt.AddDays(8), inviteId);

        fresh[inviteId].Status.Should().Be(CooperationCardStatus.Pending);
        stale[inviteId].Status.Should().Be(CooperationCardStatus.Expired);
        stale[inviteId].RequestedScope.Should().Be(LinkCapabilityScope.TrainingOnly);
    }

    [Fact]
    public async Task RejectedRequest_ReadsDeclined_WithoutScope()
    {
        var coach = await TestActors.Trainer(factory).CreateAsync(Ct);
        var client = await TestActors.Client(factory).CreateAsync(Ct);
        var requestId = await ConversationListSeed.SeedRequestAsync(factory, coach, client, ClientRequestStatus.Rejected);

        var result = await ResolveAsync(DateTime.UtcNow, requestId);

        result[requestId].Status.Should().Be(CooperationCardStatus.Declined);
        result[requestId].RequestedScope.Should().BeNull();
    }
}
