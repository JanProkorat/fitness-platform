using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.WorkoutLogs.CompleteWorkout;
using FitnessPlatform.Application.Features.WorkoutLogs.StartWorkout;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.WorkoutLogs;

/// <summary>
/// Tests for session-lock enforcement around StartWorkout and CompleteWorkout endpoints (issue #382).
///
/// Design note (#401): StartWorkout no longer acquires the Live lock — that responsibility
/// moved to GoLiveEndpoint (see GoLiveEndpointTests for the lock-state-machine coverage).
/// StartWorkout now ONLY creates the draft log. Lock-enforcement tests that previously targeted
/// StartWorkout have been relocated here to GoLive (or deleted where GoLiveEndpointTests already
/// provides equivalent coverage). The remaining StartWorkout tests assert that:
///   - Ad-hoc workouts (null PlanId or null SessionId) create a draft log without touching the lock service.
///   - Plan-bound workouts create a draft log without touching the lock service (GoLive handles the lock).
/// </summary>
public class SessionLockEnforcementTests
{
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _planId = Guid.NewGuid();
    private readonly Guid _sessionId = Guid.NewGuid();

    private TrainingPlan MakePlan(Guid? clientId = null)
    {
        return new TrainingPlan
        {
            ExternalId = _planId,
            ClientId = clientId ?? _clientId,
            TrainerId = _trainerId,
            Name = "Test Plan",
            Status = TrainingPlanStatus.Active,
            Weeks = [],
            Version = 1,
            DateCreated = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Builds a mock IApplicationDbContext with a ClientProfile for _clientId.
    /// PublicId = _clientId (test shortcut — plan.ClientId uses _clientId so it still matches).
    /// </summary>
    private IApplicationDbContext CreateDbWithProfile() =>
        new MockDbBuilder()
            .With(new ClientProfile { Id = 1, UserId = _clientId, PublicId = _clientId })
            .Build();

    private StartWorkoutEndpoint CreateStartEndpoint(IMongoContext mongo)
    {
        return Factory.Create<StartWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, CreateDbWithProfile());
    }

    // ── StartWorkout tests ────────────────────────────────────────────────────
    // StartWorkout creates the draft log only; it does NOT interact with ISessionLockService.
    // Lock acquisition (Live lock) and the 409-on-Editing enforcement live in GoLiveEndpoint
    // (see GoLiveEndpointTests.GoLive_ValidPlanBoundLog_Returns200_AcquiresLock_BroadcastsLive
    //  and GoLiveEndpointTests.GoLive_SessionInEditingState_Returns409_EmitsNothing).

    [Fact]
    public async Task StartWorkout_PlanBoundSession_CreatesDraftLogAndReturns201()
    {
        // Arrange — plan-bound workout: StartWorkout should create the draft and return 201
        // WITHOUT acquiring any lock (GoLive owns that step).
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(plans: [MakePlan()]);
        var ep = CreateStartEndpoint(mongo);

        var req = new StartWorkoutRequest { PlanId = _planId, SessionId = _sessionId };

        // Act
        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        // Assert — draft log created
        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.WorkoutLogs.Received(1).InsertOneAsync(
            Arg.Is<WorkoutLog>(w => w.ClientId == _clientId && w.SessionId == _sessionId),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task StartWorkout_NullPlanId_CreatesDraftLogAndReturns201()
    {
        // Arrange — ad-hoc workout: no PlanId, no SessionId
        var mongo = WorkoutLogTestHelpers.CreateMockMongo();
        var ep = CreateStartEndpoint(mongo);

        // Act
        await ep.HandleAsync(new StartWorkoutRequest { PlanId = null, SessionId = null },
            TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.WorkoutLogs.Received(1).InsertOneAsync(
            Arg.Is<WorkoutLog>(w => w.ClientId == _clientId && w.PlanId == null && w.SessionId == null),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task StartWorkout_NullSessionIdOnly_CreatesDraftLogAndReturns201()
    {
        // Arrange — PlanId provided but SessionId is null: ad-hoc relative to a plan
        var mongo = WorkoutLogTestHelpers.CreateMockMongo();
        var ep = CreateStartEndpoint(mongo);

        // Act
        await ep.HandleAsync(new StartWorkoutRequest { PlanId = _planId, SessionId = null },
            TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await mongo.WorkoutLogs.Received(1).InsertOneAsync(
            Arg.Is<WorkoutLog>(w => w.ClientId == _clientId && w.PlanId == _planId && w.SessionId == null),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    // ── CompleteWorkout tests ─────────────────────────────────────────────────

    private IWorkoutCompletionService MockCompletionService()
    {
        var svc = Substitute.For<IWorkoutCompletionService>();
        svc.CompleteAsync(Arg.Any<WorkoutLog>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
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

    private CompleteWorkoutEndpoint CreateCompleteEndpoint(
        IMongoContext mongo,
        IWorkoutCompletionService completionService,
        ISessionLockService lockService)
    {
        return Factory.Create<CompleteWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, completionService, lockService, Substitute.For<IRealtimeNotifier>(),
            StubComplianceService(), Substitute.For<ILogger<CompleteWorkoutEndpoint>>());
    }

    [Fact]
    public async Task CompleteWorkout_PlanBoundLog_ReleasesLiveLock()
    {
        // Arrange — plan-bound log (SessionId non-null)
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(
            externalId: logId, clientId: _clientId, planId: _planId, sessionId: _sessionId);

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log]);
        var completionService = MockCompletionService();
        var lockService = Substitute.For<ISessionLockService>();
        lockService.ReleaseAsync(Arg.Any<Guid>(), Arg.Any<LockHolder>(), Arg.Any<LockType>(),
            Arg.Any<CancellationToken>()).Returns(true);

        var ep = CreateCompleteEndpoint(mongo, completionService, lockService);

        // Act
        await ep.HandleAsync(new CompleteWorkoutRequest { LogId = logId },
            TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // ReleaseAsync must have been called with the session's id and Client/Live
        await lockService.Received(1).ReleaseAsync(
            _sessionId, LockHolder.Client, LockType.Live,
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CompleteWorkout_AdHocLog_SkipsLockRelease()
    {
        // Arrange — ad-hoc log (SessionId is null)
        var logId = Guid.NewGuid();
        var log = WorkoutLogTestHelpers.CreateLog(
            externalId: logId, clientId: _clientId, sessionId: null);

        var mongo = WorkoutLogTestHelpers.CreateMockMongo(logs: [log]);
        var completionService = MockCompletionService();
        var lockService = Substitute.For<ISessionLockService>();

        var ep = CreateCompleteEndpoint(mongo, completionService, lockService);

        // Act
        await ep.HandleAsync(new CompleteWorkoutRequest { LogId = logId },
            TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // ReleaseAsync must NOT have been called
        await lockService.DidNotReceive().ReleaseAsync(
            Arg.Any<Guid>(), Arg.Any<LockHolder>(), Arg.Any<LockType>(),
            Arg.Any<CancellationToken>());
    }
}
