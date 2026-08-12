using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.WorkoutLogs.CompleteWorkout;
using FitnessPlatform.Application.Features.WorkoutLogs.GoLive;
using FitnessPlatform.Application.Features.WorkoutLogs.StartWorkout;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.WorkoutLogs;

/// <summary>
/// Tests that verify the <c>sessioneditlockchanged</c> SignalR broadcast behaviour
/// for the workout-log endpoints (issues #383, #401).
/// Covers:
///   - StartWorkout: creates draft log WITHOUT any broadcast (issue #401 fix)
///   - GoLive: acquire Live lock → emits state=Live to BOTH clientId and trainerId
///   - GoLive: 409 conflict (session in Editing) → emits NOTHING
///   - GoLive: ad-hoc log (no SessionId on log) → 200, emits NOTHING
///   - CompleteWorkout: plan-bound log, ReleaseAsync=true → emits state=Stable to BOTH parties
///   - CompleteWorkout: plan-bound log, ReleaseAsync=false (already gone) → emits NOTHING
///   - CompleteWorkout: ad-hoc log (no SessionId) → emits NOTHING
/// </summary>
public class SessionLockBroadcastWorkoutTests
{
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _planId = Guid.NewGuid();
    private readonly Guid _sessionId = Guid.NewGuid();

    private static readonly IOptions<TrainingLockOptions> LockOptions =
        Options.Create(new TrainingLockOptions { LiveTtlHours = 6 });

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

    private ISessionLockService AcquiredLiveService()
    {
        var svc = Substitute.For<ISessionLockService>();
        var lockDoc = new SessionLock
        {
            SessionId = _sessionId,
            PlanId = _planId,
            ClientId = _clientId,
            TrainerId = _trainerId,
            Holder = LockHolder.Client,
            Type = LockType.Live,
            AcquiredAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(6)
        };
        svc.AcquireAsync(
                Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(),
                Arg.Any<LockHolder>(), Arg.Any<LockType>(), Arg.Any<TimeSpan>(),
                Arg.Any<CancellationToken>())
            .Returns(new AcquireResult.Acquired(lockDoc));
        return svc;
    }

    private static ISessionLockService ConflictLockService()
    {
        var svc = Substitute.For<ISessionLockService>();
        svc.AcquireAsync(
                Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(),
                Arg.Any<LockHolder>(), Arg.Any<LockType>(), Arg.Any<TimeSpan>(),
                Arg.Any<CancellationToken>())
            .Returns(new AcquireResult.LockConflict());
        return svc;
    }

    private static IWorkoutCompletionService StubCompletionService()
    {
        var svc = Substitute.For<IWorkoutCompletionService>();
        svc.CompleteAsync(Arg.Any<SessionExecution>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns(new List<string>());
        return svc;
    }

    private static IComplianceService StubComplianceService()
    {
        var svc = Substitute.For<IComplianceService>();
        svc.CalculateComplianceAsync(Arg.Any<Guid>(), Arg.Any<DateTime>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns(new ComplianceResult { CompliancePercent = 100m });
        svc.CalculateStreakAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(1);
        return svc;
    }

    // ── StartWorkout: creates draft log WITHOUT any broadcast (issue #401) ───────

    [Fact]
    public async Task StartWorkout_PlanBound_EmitsNothing_LiveLockMovedToGoLive()
    {
        // StartWorkout must NOT emit sessioneditlockchanged — that is GoLive's job (issue #401).
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(plans: [MakePlan()]);

        // Since #840, TrainingPlan.ClientId stores ApplicationUser.Id directly, so
        // StartWorkoutEndpoint's ownership check no longer needs an IApplicationDbContext.
        var ep = Factory.Create<StartWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo);

        await ep.HandleAsync(
            new StartWorkoutRequest { PlanId = _planId, SessionId = _sessionId },
            TestContext.Current.CancellationToken);

        // 201 created — but zero notifications (no lock acquired yet)
        ep.HttpContext.Response.StatusCode.Should().Be(201);
    }

    // ── GoLive: Live lock acquired → emits state=Live to BOTH parties ────────────

    [Fact]
    public async Task GoLive_LiveLockAcquired_EmitsLiveToBothClientAndTrainer()
    {
        // Arrange — draft log exists, lock acquisition succeeds
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(
            externalId: logId, clientId: _clientId, planId: _planId, sessionId: _sessionId);

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log], plans: [MakePlan()]);
        var lockService = AcquiredLiveService();
        var notifier = Substitute.For<IRealtimeNotifier>();

        var ep = Factory.Create<GoLiveEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, lockService, LockOptions, notifier, EndpointTestHelpers.CreateGrantingAuthHelper());

        // Act
        await ep.HandleAsync(new GoLiveRequest { LogId = logId }, TestContext.Current.CancellationToken);

        // Assert — 200 OK
        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // Must emit to the CLIENT's user id
        await notifier.Received(1).NotifyAsync(
            _clientId,
            "sessioneditlockchanged",
            Arg.Is<SessionLockChangedPayload>(p =>
                p.PlanId == _planId &&
                p.SessionId == _sessionId &&
                p.State == "Live" &&
                p.Holder == "Client"),
            Arg.Any<CancellationToken>());

        // Must emit to the TRAINER's user id
        await notifier.Received(1).NotifyAsync(
            _trainerId,
            "sessioneditlockchanged",
            Arg.Is<SessionLockChangedPayload>(p =>
                p.PlanId == _planId &&
                p.SessionId == _sessionId &&
                p.State == "Live" &&
                p.Holder == "Client"),
            Arg.Any<CancellationToken>());

        // Exactly 2 notifications (one per party)
        await notifier.Received(2).NotifyAsync(
            Arg.Any<Guid>(),
            "sessioneditlockchanged",
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    // ── GoLive: 409 conflict (Editing lock held) → emits NOTHING ─────────────────

    [Fact]
    public async Task GoLive_LockConflict_Returns409_EmitsNothing()
    {
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(
            externalId: logId, clientId: _clientId, planId: _planId, sessionId: _sessionId);

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log], plans: [MakePlan()]);
        var lockService = ConflictLockService();
        var notifier = Substitute.For<IRealtimeNotifier>();

        var ep = Factory.Create<GoLiveEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, lockService, LockOptions, notifier, EndpointTestHelpers.CreateGrantingAuthHelper());

        await ep.HandleAsync(new GoLiveRequest { LogId = logId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);

        await notifier.DidNotReceive().NotifyAsync(
            Arg.Any<Guid>(),
            Arg.Any<string>(),
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    // ── GoLive: ad-hoc log (no SessionId) → 200, emits NOTHING ──────────────────

    [Fact]
    public async Task GoLive_AdHocLog_NoSessionId_Returns200_EmitsNothing()
    {
        var logId = Guid.NewGuid();
        // Ad-hoc log — no PlanId or SessionId on the log
        var log = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log]);
        var lockService = Substitute.For<ISessionLockService>();
        var notifier = Substitute.For<IRealtimeNotifier>();

        var ep = Factory.Create<GoLiveEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, lockService, LockOptions, notifier, EndpointTestHelpers.CreateGrantingAuthHelper());

        await ep.HandleAsync(new GoLiveRequest { LogId = logId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // No lock acquired and no broadcast for ad-hoc workouts
        await lockService.DidNotReceive().AcquireAsync(
            Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(),
            Arg.Any<LockHolder>(), Arg.Any<LockType>(), Arg.Any<TimeSpan>(),
            Arg.Any<CancellationToken>());

        await notifier.DidNotReceive().NotifyAsync(
            Arg.Any<Guid>(),
            "sessioneditlockchanged",
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    // ── CompleteWorkout: plan-bound, ReleaseAsync=true → emits Stable to BOTH ───

    [Fact]
    public async Task CompleteWorkout_PlanBound_ReleaseTrue_EmitsStableToBothParties()
    {
        // Arrange — plan-bound log (SessionId non-null); lock released → emit Stable
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(
            externalId: logId, clientId: _clientId, planId: _planId, sessionId: _sessionId);

        // Must include the plan in mongo so the trainer fan-out can resolve TrainerId
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log], plans: [MakePlan()]);

        var lockService = Substitute.For<ISessionLockService>();
        lockService.ReleaseAsync(Arg.Any<Guid>(), Arg.Any<LockHolder>(), Arg.Any<LockType>(),
            Arg.Any<CancellationToken>()).Returns(true);

        var notifier = Substitute.For<IRealtimeNotifier>();

        var ep = Factory.Create<CompleteWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, StubCompletionService(), lockService, notifier,
            StubComplianceService(), EndpointTestHelpers.CreateGrantingAuthHelper(),
            Substitute.For<ILogger<CompleteWorkoutEndpoint>>());

        // Act
        await ep.HandleAsync(
            new CompleteWorkoutRequest { LogId = logId },
            TestContext.Current.CancellationToken);

        // Assert — 200 and two notifications
        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // Must emit to the CLIENT's user id
        await notifier.Received(1).NotifyAsync(
            _clientId,
            "sessioneditlockchanged",
            Arg.Is<SessionLockChangedPayload>(p =>
                p.PlanId == _planId &&
                p.SessionId == _sessionId &&
                p.State == "Stable" &&
                p.Holder == "Client"),
            Arg.Any<CancellationToken>());

        // Must emit to the TRAINER's user id
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

    // ── CompleteWorkout: revoked/nutrition-only link → Stable to client only, NOT trainer ──

    [Fact]
    public async Task CompleteWorkout_RevokedOrNutritionOnlyLink_EmitsStableToClientOnly_NotTrainer()
    {
        // Arrange — same plan-bound log as the happy path, but the trainer's link no longer
        // grants CanViewTrainingPlans (revoked collaboration, or narrowed to nutrition-only).
        // The client must still receive their own lock state; the trainer must receive nothing (F6/F11 residual).
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(
            externalId: logId, clientId: _clientId, planId: _planId, sessionId: _sessionId);

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log], plans: [MakePlan()]);

        var lockService = Substitute.For<ISessionLockService>();
        lockService.ReleaseAsync(Arg.Any<Guid>(), Arg.Any<LockHolder>(), Arg.Any<LockType>(),
            Arg.Any<CancellationToken>()).Returns(true);

        var notifier = Substitute.For<IRealtimeNotifier>();

        var ep = Factory.Create<CompleteWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, StubCompletionService(), lockService, notifier,
            StubComplianceService(), EndpointTestHelpers.CreateGrantingAuthHelper(hasAccess: false),
            Substitute.For<ILogger<CompleteWorkoutEndpoint>>());

        // Act
        await ep.HandleAsync(
            new CompleteWorkoutRequest { LogId = logId },
            TestContext.Current.CancellationToken);

        // Assert — 200 OK; lock still released (the release is authoritative, not gated on link capability)
        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // Client still receives their own lock-state change.
        await notifier.Received(1).NotifyAsync(
            _clientId,
            "sessioneditlockchanged",
            Arg.Any<SessionLockChangedPayload>(),
            Arg.Any<CancellationToken>());

        // Trainer receives NOTHING for sessioneditlockchanged — the link no longer grants
        // training-plan access. (trainingprogressupdated is independently gated too, so this
        // asserts no NotifyAsync call at all reaches the trainer.)
        await notifier.DidNotReceive().NotifyAsync(
            _trainerId,
            Arg.Any<string>(),
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    // ── CompleteWorkout: ReleaseAsync=false → emits NOTHING ─────────────────────

    [Fact]
    public async Task CompleteWorkout_PlanBound_ReleaseFalse_EmitsNothing()
    {
        // Arrange — plan-bound log but lock was already gone; ReleaseAsync returns false
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(
            externalId: logId, clientId: _clientId, planId: _planId, sessionId: _sessionId);

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log], plans: [MakePlan()]);

        var lockService = Substitute.For<ISessionLockService>();
        // ReleaseAsync returns false — lock was already expired or released
        lockService.ReleaseAsync(Arg.Any<Guid>(), Arg.Any<LockHolder>(), Arg.Any<LockType>(),
            Arg.Any<CancellationToken>()).Returns(false);

        var notifier = Substitute.For<IRealtimeNotifier>();

        var ep = Factory.Create<CompleteWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, StubCompletionService(), lockService, notifier,
            StubComplianceService(), EndpointTestHelpers.CreateGrantingAuthHelper(),
            Substitute.For<ILogger<CompleteWorkoutEndpoint>>());

        // Act
        await ep.HandleAsync(
            new CompleteWorkoutRequest { LogId = logId },
            TestContext.Current.CancellationToken);

        // Assert — 200 and NO lock-change notifications
        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // Only emit on a real state transition (ReleaseAsync=true)
        await notifier.DidNotReceive().NotifyAsync(
            Arg.Any<Guid>(),
            "sessioneditlockchanged",
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    // ── CompleteWorkout: ad-hoc (no SessionId) → emits NOTHING ──────────────────

    [Fact]
    public async Task CompleteWorkout_AdHoc_NoSessionId_EmitsNothing()
    {
        // Arrange — ad-hoc log with no SessionId (no lock was acquired)
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(
            externalId: logId, clientId: _clientId); // no SessionId

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log]);
        var lockService = Substitute.For<ISessionLockService>();
        var notifier = Substitute.For<IRealtimeNotifier>();

        var ep = Factory.Create<CompleteWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, StubCompletionService(), lockService, notifier,
            StubComplianceService(), EndpointTestHelpers.CreateGrantingAuthHelper(),
            Substitute.For<ILogger<CompleteWorkoutEndpoint>>());

        // Act
        await ep.HandleAsync(
            new CompleteWorkoutRequest { LogId = logId },
            TestContext.Current.CancellationToken);

        // Assert — 200 and NO lock-change notifications
        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await notifier.DidNotReceive().NotifyAsync(
            Arg.Any<Guid>(),
            "sessioneditlockchanged",
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());

        // Lock release must not have been called on ad-hoc workouts
        await lockService.DidNotReceive().ReleaseAsync(
            Arg.Any<Guid>(), Arg.Any<LockHolder>(), Arg.Any<LockType>(), Arg.Any<CancellationToken>());
    }
}
