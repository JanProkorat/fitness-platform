using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.TrainingPlans.GetTrainingPlan;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints;

namespace FitnessPlatform.Tests.Endpoints.TrainingPlans;

/// <summary>
/// Tests for the per-session edit-lock state projection added to
/// <see cref="GetTrainingPlanEndpoint"/> as the backend prerequisite for #384.
/// Verifies the three lock state scenarios:
/// <list type="bullet">
///   <item><description>(a) No active lock → SessionLockStates is empty (Stable implied).</description></item>
///   <item><description>(b) Session has an active Editing lock held by Coach → appears in SessionLockStates.</description></item>
///   <item><description>(c) Session has an active Live lock held by Client → appears in SessionLockStates.</description></item>
/// </list>
/// </summary>
public class GetTrainingPlanLockStateTests
{
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly Guid _planId = Guid.NewGuid();
    private readonly Guid _sessionId = Guid.NewGuid();

    // ── Helper builders ───────────────────────────────────────────────────────

    private TrainingPlan BuildPlanWithSession()
    {
        return new TrainingPlan
        {
            ExternalId = _planId,
            ClientId = _clientId,
            TrainerId = _trainerId,
            Name = "Lock State Test Plan",
            Status = TrainingPlanStatus.Active,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    Days = TrainingPlanTestHelpers.MaterializeDays((1, new TrainingSession
                    {
                        SessionId = _sessionId,
                        Name = "Push Day",
                        Order = 1,
                        Workouts = []
                    }))
                }
            ],
            Version = 1,
            DateCreated = DateTime.UtcNow
        };
    }

    private SessionLock BuildLock(LockType type, LockHolder holder)
    {
        return new SessionLock
        {
            SessionId = _sessionId,
            PlanId = _planId,
            ClientId = _clientId,
            TrainerId = _trainerId,
            Type = type,
            Holder = holder,
            AcquiredAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(2)
        };
    }

    private async Task<GetTrainingPlanResponse?> ExecuteAsync(params SessionLock[] locks)
    {
        var plan = BuildPlanWithSession();
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);
        var lockService = TrainingPlanTestHelpers.CreateLockServiceWith(locks);

        var ep = Factory.Create<GetTrainingPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo,
            lockService,
            new MockDbBuilder().Build(),
            EndpointTestHelpers.CreateGrantingAuthHelper());

        await ep.HandleAsync(
            new GetTrainingPlanRequest { PlanId = _planId },
            TestContext.Current.CancellationToken);

        return ep.HttpContext.Response.StatusCode == 200 ? ep.Response : null;
    }

    // ── Test cases ────────────────────────────────────────────────────────────

    /// <summary>
    /// (a) No active lock → <c>SessionLockStates</c> is empty.
    /// A session absent from the list is implicitly Stable.
    /// </summary>
    [Fact]
    public async Task GetPlan_NoActiveLock_SessionLockStatesIsEmpty()
    {
        var response = await ExecuteAsync(); // no locks

        response.Should().NotBeNull();
        response!.SessionLockStates.Should().BeEmpty();
    }

    /// <summary>
    /// (b) Session has an active Editing lock held by Coach →
    /// <c>SessionLockStates</c> contains one entry with LockState="Editing" and LockHolder="Coach".
    /// </summary>
    [Fact]
    public async Task GetPlan_SessionWithEditingLock_ReturnsEditingCoach()
    {
        var editingLock = BuildLock(LockType.Editing, LockHolder.Coach);

        var response = await ExecuteAsync(editingLock);

        response.Should().NotBeNull();
        response!.SessionLockStates.Should().ContainSingle(ls =>
            ls.SessionId == _sessionId &&
            ls.LockState == "Editing" &&
            ls.LockHolder == "Coach");
    }

    /// <summary>
    /// (c) Session has an active Live lock held by Client →
    /// <c>SessionLockStates</c> contains one entry with LockState="Live" and LockHolder="Client".
    /// </summary>
    [Fact]
    public async Task GetPlan_SessionWithLiveLock_ReturnsLiveClient()
    {
        var liveLock = BuildLock(LockType.Live, LockHolder.Client);

        var response = await ExecuteAsync(liveLock);

        response.Should().NotBeNull();
        response!.SessionLockStates.Should().ContainSingle(ls =>
            ls.SessionId == _sessionId &&
            ls.LockState == "Live" &&
            ls.LockHolder == "Client");
    }
}
