using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.WorkoutLogs.GoLive;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Endpoints;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.WorkoutLogs;

/// <summary>
/// Tests for <see cref="GoLiveEndpoint"/> (issue #401 — Defect 1 fix).
/// GoLive acquires the Live lock and broadcasts state=Live ONLY when the client presses
/// Start on the session intro page. The draft log already exists at that point.
/// </summary>
public class GoLiveEndpointTests
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
        svc.AcquireAsync(
                Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(),
                Arg.Any<LockHolder>(), Arg.Any<LockType>(), Arg.Any<TimeSpan>(),
                Arg.Any<CancellationToken>())
            .Returns(new AcquireResult.Acquired(new SessionLock
            {
                SessionId = _sessionId, PlanId = _planId,
                ClientId = _clientId, TrainerId = _trainerId,
                Holder = LockHolder.Client, Type = LockType.Live,
                AcquiredAt = DateTime.UtcNow, ExpiresAt = DateTime.UtcNow.AddHours(6)
            }));
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

    // ── Tests ────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GoLive_ValidPlanBoundLog_Returns200_AcquiresLock_BroadcastsLive()
    {
        // Arrange — draft log exists, plan exists, lock acquisition succeeds
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(
            externalId: logId, clientId: _clientId, planId: _planId, sessionId: _sessionId);

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log], plans: [MakePlan()]);
        var lockService = AcquiredLiveService();
        var notifier = Substitute.For<IRealtimeNotifier>();

        var ep = Factory.Create<GoLiveEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, lockService, LockOptions, notifier, EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

        // Act
        await ep.HandleAsync(new GoLiveRequest { LogId = logId }, TestContext.Current.CancellationToken);

        // Assert — 200 and lock acquired with correct args
        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await lockService.Received(1).AcquireAsync(
            _sessionId,
            _planId,
            _clientId,
            _trainerId,
            LockHolder.Client,
            LockType.Live,
            TimeSpan.FromHours(6),
            Arg.Any<CancellationToken>());

        // Broadcast state=Live to BOTH client and trainer
        await notifier.Received(1).NotifyAsync(
            _clientId,
            "sessioneditlockchanged",
            Arg.Is<SessionLockChangedPayload>(p =>
                p.PlanId == _planId &&
                p.SessionId == _sessionId &&
                p.State == "Live" &&
                p.Holder == "Client"),
            Arg.Any<CancellationToken>());

        await notifier.Received(1).NotifyAsync(
            _trainerId,
            "sessioneditlockchanged",
            Arg.Is<SessionLockChangedPayload>(p =>
                p.PlanId == _planId &&
                p.SessionId == _sessionId &&
                p.State == "Live" &&
                p.Holder == "Client"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GoLive_RevokedOrNutritionOnlyLink_EmitsLiveToClientOnly_NotTrainer()
    {
        // Arrange — same plan-bound log as the happy path, but the trainer's link no longer
        // grants CanViewTrainingPlans (revoked collaboration, or narrowed to nutrition-only).
        // The client must still receive their own lock state; the trainer must receive nothing (F6/F11 residual).
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(
            externalId: logId, clientId: _clientId, planId: _planId, sessionId: _sessionId);

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log], plans: [MakePlan()]);
        var lockService = AcquiredLiveService();
        var notifier = Substitute.For<IRealtimeNotifier>();

        var ep = Factory.Create<GoLiveEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, lockService, LockOptions, notifier,
            WorkoutLogTestHelpers.CreateDenyingLinkAuthorizationService());

        // Act
        await ep.HandleAsync(new GoLiveRequest { LogId = logId }, TestContext.Current.CancellationToken);

        // Assert — 200 OK; lock still acquired (the lock is authoritative, not gated on link capability)
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
    public async Task GoLive_NoClaims_Returns401()
    {
        var mongo = WorkoutLogTestHelpers.CreateMockMongo();

        var ep = Factory.Create<GoLiveEndpoint>(
            mongo, Substitute.For<ISessionLockService>(), LockOptions, Substitute.For<IRealtimeNotifier>(),
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

        await ep.HandleAsync(new GoLiveRequest { LogId = Guid.NewGuid() }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task GoLive_LogNotFound_Returns404()
    {
        // No log in Mongo matching the request
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: []);
        var lockService = Substitute.For<ISessionLockService>();
        var notifier = Substitute.For<IRealtimeNotifier>();

        var ep = Factory.Create<GoLiveEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, lockService, LockOptions, notifier, EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

        await ep.HandleAsync(new GoLiveRequest { LogId = Guid.NewGuid() }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);

        await lockService.DidNotReceive().AcquireAsync(
            Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(),
            Arg.Any<LockHolder>(), Arg.Any<LockType>(), Arg.Any<TimeSpan>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GoLive_OtherClientsLog_Returns404()
    {
        // Log belongs to a different client — ownership check via ClientId filter
        var differentClientId = Guid.NewGuid();
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(
            externalId: logId, clientId: differentClientId, planId: _planId, sessionId: _sessionId);

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: []); // filter returns empty for this caller
        var lockService = Substitute.For<ISessionLockService>();

        var ep = Factory.Create<GoLiveEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, lockService, LockOptions, Substitute.For<IRealtimeNotifier>(),
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

        await ep.HandleAsync(new GoLiveRequest { LogId = logId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task GoLive_SessionInEditingState_Returns409_EmitsNothing()
    {
        // Session is currently Editing-locked by the trainer — go-live is blocked
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(
            externalId: logId, clientId: _clientId, planId: _planId, sessionId: _sessionId);

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log], plans: [MakePlan()]);
        var lockService = ConflictLockService();
        var notifier = Substitute.For<IRealtimeNotifier>();

        var ep = Factory.Create<GoLiveEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, lockService, LockOptions, notifier, EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

        await ep.HandleAsync(new GoLiveRequest { LogId = logId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);

        // No broadcast when acquisition failed — no state transition occurred
        await notifier.DidNotReceive().NotifyAsync(
            Arg.Any<Guid>(),
            Arg.Any<string>(),
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GoLive_AdHocLog_NoSessionId_Returns200_NoLockAcquired()
    {
        // Ad-hoc workouts have no session — go-live is a no-op success
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(externalId: logId, clientId: _clientId);

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log]);
        var lockService = Substitute.For<ISessionLockService>();
        var notifier = Substitute.For<IRealtimeNotifier>();

        var ep = Factory.Create<GoLiveEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, lockService, LockOptions, notifier, EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

        await ep.HandleAsync(new GoLiveRequest { LogId = logId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await lockService.DidNotReceive().AcquireAsync(
            Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(),
            Arg.Any<LockHolder>(), Arg.Any<LockType>(), Arg.Any<TimeSpan>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GoLive_PlanNotFound_Returns404()
    {
        // Log exists with PlanId but the plan has been deleted
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(
            externalId: logId, clientId: _clientId, planId: _planId, sessionId: _sessionId);

        // Plan collection is empty
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log], plans: []);
        var lockService = Substitute.For<ISessionLockService>();

        var ep = Factory.Create<GoLiveEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, lockService, LockOptions, Substitute.For<IRealtimeNotifier>(),
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

        await ep.HandleAsync(new GoLiveRequest { LogId = logId }, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
