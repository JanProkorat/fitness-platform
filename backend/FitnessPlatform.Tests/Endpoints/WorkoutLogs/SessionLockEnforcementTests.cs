using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.WorkoutLogs.CompleteWorkout;
using FitnessPlatform.Application.Features.WorkoutLogs.StartWorkout;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Endpoints;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.WorkoutLogs;

/// <summary>
/// Tests for session-lock enforcement in StartWorkout and CompleteWorkout endpoints (issue #382).
/// </summary>
public class SessionLockEnforcementTests
{
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _planId = Guid.NewGuid();
    private readonly Guid _sessionId = Guid.NewGuid();

    private IOptions<TrainingLockOptions> DefaultLockOptions()
    {
        var opts = new TrainingLockOptions { LiveTtlHours = 6, EditingTtlHours = 2 };
        return Options.Create(opts);
    }

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

    private ISessionLockService AcquiredLockService()
    {
        var svc = Substitute.For<ISessionLockService>();
        svc.AcquireAsync(
                Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(),
                Arg.Any<LockHolder>(), Arg.Any<LockType>(), Arg.Any<TimeSpan>(),
                Arg.Any<CancellationToken>())
            .Returns(new AcquireResult.Acquired(new SessionLock
            {
                SessionId = _sessionId,
                PlanId = _planId,
                ClientId = _clientId,
                TrainerId = _trainerId,
                Holder = LockHolder.Client,
                Type = LockType.Live,
                AcquiredAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddHours(6)
            }));
        return svc;
    }

    private ISessionLockService LockedLockService()
    {
        var svc = Substitute.For<ISessionLockService>();
        svc.AcquireAsync(
                Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(),
                Arg.Any<LockHolder>(), Arg.Any<LockType>(), Arg.Any<TimeSpan>(),
                Arg.Any<CancellationToken>())
            .Returns(new AcquireResult.LockConflict());
        return svc;
    }

    private StartWorkoutEndpoint CreateStartEndpoint(
        IMongoContext mongo,
        ISessionLockService lockService)
    {
        return Factory.Create<StartWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, lockService, DefaultLockOptions());
    }

    // ── StartWorkout tests ────────────────────────────────────────────────────

    [Fact]
    public async Task StartWorkout_SessionInEditingState_Returns409SessionLocked()
    {
        // Arrange — plan exists, lock acquisition fails (session is Editing)
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(plans: [MakePlan()]);
        var lockService = LockedLockService();
        var ep = CreateStartEndpoint(mongo, lockService);

        var req = new StartWorkoutRequest { PlanId = _planId, SessionId = _sessionId };

        // Act
        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(409);
        // No WorkoutLog must have been inserted
        await mongo.WorkoutLogs.DidNotReceive().InsertOneAsync(
            Arg.Any<WorkoutLog>(),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task StartWorkout_StableSession_AcquiresLockAndReturns201()
    {
        // Arrange — plan exists, lock acquisition succeeds
        var mongo = WorkoutLogTestHelpers.CreateMockMongo(plans: [MakePlan()]);
        var lockService = AcquiredLockService();
        var ep = CreateStartEndpoint(mongo, lockService);

        var req = new StartWorkoutRequest { PlanId = _planId, SessionId = _sessionId };

        // Act
        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(201);

        // Lock must have been acquired with Client/Live
        await lockService.Received(1).AcquireAsync(
            _sessionId, _planId, _clientId, _trainerId,
            LockHolder.Client, LockType.Live,
            TimeSpan.FromHours(6),
            Arg.Any<CancellationToken>());

        // WorkoutLog must have been inserted
        await mongo.WorkoutLogs.Received(1).InsertOneAsync(
            Arg.Is<WorkoutLog>(w => w.ClientId == _clientId && w.SessionId == _sessionId),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task StartWorkout_NullPlanId_SkipsLockAndReturns201()
    {
        // Arrange — ad-hoc workout: no PlanId
        var mongo = WorkoutLogTestHelpers.CreateMockMongo();
        var lockService = Substitute.For<ISessionLockService>();
        var ep = CreateStartEndpoint(mongo, lockService);

        // Act
        await ep.HandleAsync(new StartWorkoutRequest { PlanId = null, SessionId = null },
            TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(201);

        // Lock must NOT have been acquired
        await lockService.DidNotReceive().AcquireAsync(
            Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(),
            Arg.Any<LockHolder>(), Arg.Any<LockType>(), Arg.Any<TimeSpan>(),
            Arg.Any<CancellationToken>());

        await mongo.WorkoutLogs.Received(1).InsertOneAsync(
            Arg.Is<WorkoutLog>(w => w.ClientId == _clientId && w.PlanId == null && w.SessionId == null),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task StartWorkout_NullSessionIdOnly_SkipsLockAndReturns201()
    {
        // Arrange — PlanId provided but SessionId is null: ad-hoc relative to a plan
        var mongo = WorkoutLogTestHelpers.CreateMockMongo();
        var lockService = Substitute.For<ISessionLockService>();
        var ep = CreateStartEndpoint(mongo, lockService);

        // Act
        await ep.HandleAsync(new StartWorkoutRequest { PlanId = _planId, SessionId = null },
            TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(201);

        await lockService.DidNotReceive().AcquireAsync(
            Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(),
            Arg.Any<LockHolder>(), Arg.Any<LockType>(), Arg.Any<TimeSpan>(),
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

    private CompleteWorkoutEndpoint CreateCompleteEndpoint(
        IMongoContext mongo,
        IWorkoutCompletionService completionService,
        ISessionLockService lockService)
    {
        return Factory.Create<CompleteWorkoutEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, completionService, lockService);
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
