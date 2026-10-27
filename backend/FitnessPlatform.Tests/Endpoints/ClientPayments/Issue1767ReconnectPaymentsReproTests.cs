using System.Net;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Client.GetClientPayments;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Tests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using static FitnessPlatform.Tests.Endpoints.ClientPayments.ClientPaymentFixtures;

namespace FitnessPlatform.Tests.Endpoints.ClientPayments;

/// <summary>
/// REPRODUCTIONS for #1767 (payment rows after a client reconnects to the same coach). The tests that assert the
/// expected behaviour FAIL on purpose until the fix lands; they are the regression tests for it.
/// </summary>
[Collection(TestCollection.Name)]
public class Issue1767ReconnectPaymentsReproTests(FitnessApiFactory factory)
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private async Task<List<ClientPayment>> RowsAsync(PaymentWorld world)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        return await db.ClientPayments.AsNoTracking()
            .Where(p => p.ClientPaymentAssignment.ProfessionalProfileId == world.Coach.ProfileId
                && p.ClientPaymentAssignment.ClientProfileId == world.Client.ProfileId
                && p.PeriodStart != null)
            .OrderBy(p => p.PeriodStart)
            .ToListAsync(Ct);
    }

    private async Task<List<ClientPaymentTerms>> TermsAsync(PaymentWorld world)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        return await db.ClientPaymentTerms.AsNoTracking()
            .Where(t => t.ClientPaymentAssignment.ProfessionalProfileId == world.Coach.ProfileId
                && t.ClientPaymentAssignment.ClientProfileId == world.Client.ProfileId)
            .OrderBy(t => t.Id)
            .ToListAsync(Ct);
    }

    /// <summary>Moves the assignment's terms and periods back by whole days, as if they were made on an earlier day.</summary>
    private async Task AgeDaysAsync(PaymentWorld world, int days)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var assignmentId = await db.ClientPaymentAssignments
            .Where(a => a.ClientProfileId == world.Client.ProfileId && a.ProfessionalProfileId == world.Coach.ProfileId)
            .Select(a => a.Id).SingleAsync(Ct);

        foreach (var terms in await db.ClientPaymentTerms.Where(t => t.ClientPaymentAssignmentId == assignmentId).ToListAsync(Ct))
        {
            terms.EffectiveFromUtc = terms.EffectiveFromUtc.AddDays(-days);
            terms.EndsAtUtc = terms.EndsAtUtc?.AddDays(-days);
        }

        foreach (var period in await db.ClientPayments.Where(p => p.ClientPaymentAssignmentId == assignmentId).ToListAsync(Ct))
        {
            period.PeriodStart = period.PeriodStart?.AddDays(-days);
            period.PeriodEnd = period.PeriodEnd?.AddDays(-days);
            period.DueDate = period.DueDate.AddDays(-days);
            period.VariableSymbol = null;
        }

        await db.SaveChangesAsync(Ct);
    }

    /// <summary>
    /// Symptom 3. The first collaboration's started period (today) is kept as history, so a same-day reconnect plans
    /// the new collaboration's first period one interval later.
    /// </summary>
    [Theory]
    [InlineData("Monthly", null)]
    [InlineData("EveryNWeeks", 5)]
    public async Task Reaccept_OnTheDayOfTheEnd_NewCollaborationsFirstPeriodStartsToday(string billing, int? weeks)
    {
        var world = await CreateWorldAsync(factory);
        var package = await CreatePackageAsync(world.Coach, 2500m, "Package", billing, weeks);
        await EndCollaborationAsync(world);
        await AcceptInviteAsync(world, package);
        await EndCollaborationAsync(world);
        var oldIds = (await RowsAsync(world)).Select(p => p.Id).ToHashSet();

        await AcceptInviteAsync(world, package);

        var newStarts = (await RowsAsync(world)).Where(p => !oldIds.Contains(p.Id)).Select(p => p.PeriodStart!.Value).Order().ToList();
        newStarts.Should().NotBeEmpty();
        newStarts[0].Should().Be(Today, "the new collaboration bills from the day it starts, not one interval later");
    }

    /// <summary>Symptom 3, second half: an Upcoming row of the ended collaboration is still around for the current period.</summary>
    [Fact]
    public async Task Reaccept_OnTheDayOfTheEnd_LeavesNoUpcomingRowOfTheEndedCollaboration()
    {
        var world = await CreateWorldAsync(factory);
        var package = await CreatePackageAsync(world.Coach, 2500m, "Package", "EveryNWeeks", 5);
        await EndCollaborationAsync(world);
        await AcceptInviteAsync(world, package);
        await EndCollaborationAsync(world);
        var oldIds = (await RowsAsync(world)).Select(p => p.Id).ToHashSet();

        await AcceptInviteAsync(world, package);

        (await RowsAsync(world)).Where(p => oldIds.Contains(p.Id) && p.Status == ClientPaymentStatus.Upcoming)
            .Select(p => (p.PeriodStart, p.Status, p.Amount)).Should().BeEmpty();
    }

    /// <summary>
    /// Symptom 2. A started period of an ended collaboration (stored Upcoming, frozen amount, not IsKeptAfterEnd)
    /// can be requested by the coach and shows up for the client.
    /// </summary>
    [Fact]
    public async Task Request_StartedPeriodOfAnEndedCollaboration_IsRefusedAndNeverReachesTheClient()
    {
        var world = await CreateWorldAsync(factory);
        var package = await CreatePackageAsync(world.Coach, 2500m, "Package");
        await EndCollaborationAsync(world);
        await AcceptInviteAsync(world, package);
        await EndCollaborationAsync(world);
        await AgeDaysAsync(world, 1);
        var old = (await RowsAsync(world)).Should().ContainSingle().Subject;
        old.Status.Should().Be(ClientPaymentStatus.Upcoming);
        old.PeriodStart.Should().Be(Today.AddDays(-1));

        var response = await PostActionAsync(world, old.PublicId, "request", new { SendNotification = true });

        response.StatusCode.Should().BeOneOf(HttpStatusCode.NotFound, HttpStatusCode.Conflict, HttpStatusCode.Forbidden);
        (await ReadStoredAsync(factory, old.PublicId)).Status.Should().Be(ClientPaymentStatus.Upcoming);
        var clientView = await world.Client.Http.GetAsync("/client/payments", Ct);
        (await ReadAsync<GetClientPaymentsResponse>(clientView)).Coaches.SelectMany(c => c.Requested).Should().BeEmpty();
    }

    /// <summary>Symptom 2 after a reconnect: the earlier collaboration's row is still requestable while the new one runs.</summary>
    [Fact]
    public async Task Request_RowOfAnEarlierCollaboration_AfterAReconnect_IsRefused()
    {
        var world = await CreateWorldAsync(factory);
        var package = await CreatePackageAsync(world.Coach, 2500m, "Package");
        await EndCollaborationAsync(world);
        await AcceptInviteAsync(world, package);
        await EndCollaborationAsync(world);
        await AgeDaysAsync(world, 1);
        var old = (await RowsAsync(world)).Should().ContainSingle().Subject;
        await AcceptInviteAsync(world, package);

        var response = await PostActionAsync(world, old.PublicId, "request", new { SendNotification = true });

        response.StatusCode.Should().BeOneOf(HttpStatusCode.NotFound, HttpStatusCode.Conflict, HttpStatusCode.Forbidden);
    }

    /// <summary>
    /// Symptom 1 guard: every endpoint sequence tried (accept/end/accept, package change, ageing) closes all terms on
    /// end. Passes today; kept so the fix cannot regress it.
    /// </summary>
    [Fact]
    public async Task EndCollaboration_AfterPackageChangeAndReaccept_ClosesEveryTermsRow()
    {
        var world = await CreateWorldAsync(factory);
        var first = await CreatePackageAsync(world.Coach, 2500m, "First");
        var second = await CreatePackageAsync(world.Coach, 3000m, "Second");
        await EndCollaborationAsync(world);
        await AcceptInviteAsync(world, first);
        (await SetTermsAsync(world, second)).StatusCode.Should().Be(HttpStatusCode.OK);
        await EndCollaborationAsync(world);
        await AcceptInviteAsync(world, first);
        (await SetTermsAsync(world, second)).StatusCode.Should().Be(HttpStatusCode.OK);

        await EndCollaborationAsync(world);

        (await TermsAsync(world)).Should().OnlyContain(t => t.EndsAtUtc != null);
    }
}
