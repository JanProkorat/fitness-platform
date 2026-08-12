using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.WorkoutLogs.AbandonWorkout;
using FitnessPlatform.Tests.Endpoints;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace FitnessPlatform.Tests.Endpoints.WorkoutLogs;

/// <summary>
/// Tests for <see cref="AbandonWorkoutEndpoint"/> (issue #401 — Defect 3 fix).
/// Abandon releases the Live lock and broadcasts state=Stable, or returns idempotent 200
/// when no lock is held (already released / expired).
/// </summary>
public class AbandonWorkoutEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _planId = Guid.NewGuid();
    private readonly Guid _sessionId = Guid.NewGuid();

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private TrainingPlan MakePlan() =>
        new TrainingPlan
        {
            ExternalId = _planId,
            ClientId = _clientId,
            TrainerId = _trainerId,
            Name = "Test Plan",
            Status = TrainingPlanStatus.Active,
            Weeks = [],
            Version = 1,
            DateCreated = DateTime.UtcNow
        };

    private static ISessionLockService ReleasedLockService()
    {
        var svc = Substitute.For<ISessionLockService>();
        svc.ReleaseAsync(Arg.Any<Guid>(), Arg.Any<LockHolder>(), Arg.Any<LockType>(),
            Arg.Any<CancellationToken>()).Returns(true);
        return svc;
    }

    private static ISessionLockService NoLockHeldService()
    {
        var svc = Substitute.For<ISessionLockService>();
        svc.ReleaseAsync(Arg.Any<Guid>(), Arg.Any<LockHolder>(), Arg.Any<LockType>(),
            Arg.Any<CancellationToken>()).Returns(false); // idempotent — lock already gone
        return svc;
    }

    // ── Tests ────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Abandon_WithActiveLiveLock_Returns200_ReleasesLock_BroadcastsStable()
    {
        // Arrange — plan-bound log, Live lock held → release + broadcast Stable
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(
            externalId: logId, clientId: _clientId, planId: _planId, sessionId: _sessionId);

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log], plans: [MakePlan()]);
        var lockService = ReleasedLockService();
        var notifier = Substitute.For<IRealtimeNotifier>();

        var ep = Factory.Create<AbandonWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, lockService, notifier, EndpointTestHelpers.CreateGrantingAuthHelper());

        // Act
        await ep.HandleAsync(new AbandonWorkoutRequest { LogId = logId }, TestContext.Current.CancellationToken);

        // Assert — 200 and lock released
        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await lockService.Received(1).ReleaseAsync(
            _sessionId,
            LockHolder.Client,
            LockType.Live,
            Arg.Any<CancellationToken>());

        // Broadcast state=Stable to BOTH client and trainer
        await notifier.Received(1).NotifyAsync(
            _clientId,
            "sessioneditlockchanged",
            Arg.Is<SessionLockChangedPayload>(p =>
                p.PlanId == _planId &&
                p.SessionId == _sessionId &&
                p.State == "Stable" &&
                p.Holder == "Client"),
            Arg.Any<CancellationToken>());

        await notifier.Received(1).NotifyAsync(
            _trainerId,
            "sessioneditlockchanged",
            Arg.Is<SessionLockChangedPayload>(p =>
                p.PlanId == _planId &&
                p.SessionId == _sessionId &&
                p.State == "Stable" &&
                p.Holder == "Client"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Abandon_RevokedOrNutritionOnlyLink_EmitsStableToClientOnly_NotTrainer()
    {
        // Arrange — same plan-bound log as the happy path, but the trainer's link no longer
        // grants CanViewTrainingPlans (revoked collaboration, or narrowed to nutrition-only).
        // The client must still receive their own lock state; the trainer must receive nothing (F6/F11 residual).
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(
            externalId: logId, clientId: _clientId, planId: _planId, sessionId: _sessionId);

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log], plans: [MakePlan()]);
        var lockService = ReleasedLockService();
        var notifier = Substitute.For<IRealtimeNotifier>();

        var ep = Factory.Create<AbandonWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, lockService, notifier, EndpointTestHelpers.CreateGrantingAuthHelper(hasAccess: false));

        // Act
        await ep.HandleAsync(new AbandonWorkoutRequest { LogId = logId }, TestContext.Current.CancellationToken);

        // Assert — 200 OK; lock still released (the release is authoritative, not gated on link capability)
        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // Client still receives their own lock-state change.
        await notifier.Received(1).NotifyAsync(
            _clientId,
            "sessioneditlockchanged",
            Arg.Any<SessionLockChangedPayload>(),
            Arg.Any<CancellationToken>());

        // Trainer receives NOTHING — the link no longer grants training-plan access.
        await notifier.DidNotReceive().NotifyAsync(
            _trainerId,
            Arg.Any<string>(),
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Abandon_NoActiveLock_Returns200_IdempotentNoBroadcast()
    {
        // Arrange — ReleaseAsync returns false (lock already gone / expired)
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(
            externalId: logId, clientId: _clientId, planId: _planId, sessionId: _sessionId);

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log], plans: [MakePlan()]);
        var lockService = NoLockHeldService();
        var notifier = Substitute.For<IRealtimeNotifier>();

        var ep = Factory.Create<AbandonWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, lockService, notifier, EndpointTestHelpers.CreateGrantingAuthHelper());

        // Act
        await ep.HandleAsync(new AbandonWorkoutRequest { LogId = logId }, TestContext.Current.CancellationToken);

        // Assert — 200 idempotent success, NO broadcast (lock wasn't held)
        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await notifier.DidNotReceive().NotifyAsync(
            Arg.Any<Guid>(),
            "sessioneditlockchanged",
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Abandon_NoClaims_Returns401()
    {
        var mongo = WorkoutLogTestHelpers.CreateMockMongo();

        var ep = Factory.Create<AbandonWorkoutEndpoint>(
            mongo, Substitute.For<ISessionLockService>(), Substitute.For<IRealtimeNotifier>(),
            EndpointTestHelpers.CreateGrantingAuthHelper());

        await ep.HandleAsync(
            new AbandonWorkoutRequest { LogId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task Abandon_LogNotFound_Returns404()
    {
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: []);
        var lockService = Substitute.For<ISessionLockService>();

        var ep = Factory.Create<AbandonWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, lockService, Substitute.For<IRealtimeNotifier>(),
            EndpointTestHelpers.CreateGrantingAuthHelper());

        await ep.HandleAsync(
            new AbandonWorkoutRequest { LogId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);

        await lockService.DidNotReceive().ReleaseAsync(
            Arg.Any<Guid>(), Arg.Any<LockHolder>(), Arg.Any<LockType>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Abandon_AdHocLog_Returns200_NoBroadcast()
    {
        // Ad-hoc log with no SessionId — no lock was ever acquired, success immediately
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log]);
        var lockService = Substitute.For<ISessionLockService>();
        var notifier = Substitute.For<IRealtimeNotifier>();

        var ep = Factory.Create<AbandonWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, lockService, notifier, EndpointTestHelpers.CreateGrantingAuthHelper());

        await ep.HandleAsync(new AbandonWorkoutRequest { LogId = logId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // No release call and no broadcast for ad-hoc (no-session) workouts
        await lockService.DidNotReceive().ReleaseAsync(
            Arg.Any<Guid>(), Arg.Any<LockHolder>(), Arg.Any<LockType>(), Arg.Any<CancellationToken>());

        await notifier.DidNotReceive().NotifyAsync(
            Arg.Any<Guid>(),
            Arg.Any<string>(),
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Abandon_BroadcastFailure_StillReturns200()
    {
        // Broadcast failure must NOT fail the request — release is authoritative.
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(
            externalId: logId, clientId: _clientId, planId: _planId, sessionId: _sessionId);

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log], plans: [MakePlan()]);
        var lockService = ReleasedLockService();

        var notifier = Substitute.For<IRealtimeNotifier>();
        notifier.NotifyAsync(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<object>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException("hub unavailable (simulated)"));

        var ep = Factory.Create<AbandonWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, lockService, notifier, EndpointTestHelpers.CreateGrantingAuthHelper());

        // Act — should not throw despite notifier failure
        await ep.HandleAsync(new AbandonWorkoutRequest { LogId = logId }, TestContext.Current.CancellationToken);

        // Assert — 200; lock was released, broadcast was best-effort
        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await lockService.Received(1).ReleaseAsync(
            _sessionId, LockHolder.Client, LockType.Live, Arg.Any<CancellationToken>());
    }
}
