using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.TrainingPlans.UnlockTrainingSession;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Endpoints;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.TrainingPlans;

/// <summary>
/// Tests for the finished-guard added to <see cref="UnlockTrainingSessionEndpoint"/> (issue #429).
/// Verifies that unlocking a session whose WorkoutLog is already completed returns 409 SESSION_ALREADY_COMPLETED,
/// and that the endpoint still succeeds (204) when no completed log exists.
/// </summary>
public class UnlockSessionFinishedGuardTests
{
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _clientId = Guid.NewGuid();

    private IOptions<TrainingLockOptions> DefaultOptions() =>
        Options.Create(new TrainingLockOptions { EditingTtlHours = 2, LiveTtlHours = 6 });

    /// <summary>Creates a minimal plan with one session.</summary>
    private TrainingPlan CreatePlan(Guid planId, Guid sessionId) =>
        new()
        {
            ExternalId = planId,
            ClientId = _clientId,
            TrainerId = _trainerId,
            Name = "Test Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = TrainingPlanTestHelpers.LastMonday(),
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    Sessions =
                    [
                        new TrainingSession
                        {
                            SessionId = sessionId,
                            DayOfWeek = 1,
                            Name = "Test Session",
                            Order = 1,
                            Sections = []
                        }
                    ]
                }
            ],
            Version = 1,
            DateCreated = DateTime.UtcNow.AddDays(-30)
        };

    /// <summary>
    /// Creates an IMongoContext where WorkoutLogs.CountDocumentsAsync returns the given count.
    /// Uses CreateMockMongoWithLogs for the training-plan side to avoid duplicate stub setup.
    /// </summary>
    private IMongoContext CreateMockMongo(TrainingPlan plan, long completedLogCount)
    {
        var mongo = Substitute.For<IMongoContext>();

        // Training plans — FindAsync returns the plan
        var planCollection = TrainingPlanTestHelpers.CreateMockCollection([plan]);
        mongo.TrainingPlans.Returns(planCollection);

        // WorkoutLogs — CountDocumentsAsync returns the given count (0 or 1)
        var logCollection = Substitute.For<IMongoCollection<WorkoutLog>>();
        logCollection.CountDocumentsAsync(
                Arg.Any<FilterDefinition<WorkoutLog>>(),
                Arg.Any<CountOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(completedLogCount);
        mongo.WorkoutLogs.Returns(logCollection);

        return mongo;
    }

    /// <summary>Creates a lock service that returns <see cref="AcquireResult.Acquired"/>.</summary>
    private ISessionLockService LockServiceAcquired(Guid sessionId, Guid planId)
    {
        var svc = Substitute.For<ISessionLockService>();
        svc.AcquireAsync(
                Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(),
                Arg.Any<LockHolder>(), Arg.Any<LockType>(), Arg.Any<TimeSpan>(),
                Arg.Any<CancellationToken>())
            .Returns(new AcquireResult.Acquired(new SessionLock
            {
                SessionId = sessionId,
                PlanId = planId,
                ClientId = _clientId,
                TrainerId = _trainerId,
                Holder = LockHolder.Coach,
                Type = LockType.Editing,
                AcquiredAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddHours(2)
            }));
        return svc;
    }

    // ── Gap B: finished-guard rejects unlock on completed sessions ───────────────

    [Fact]
    public async Task Unlock_SessionAlreadyCompleted_Returns409SessionAlreadyCompleted()
    {
        // Arrange: plan exists with the session, but CountDocumentsAsync returns 1 (completed log exists).
        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var plan = CreatePlan(planId, sessionId);

        var mongo = CreateMockMongo(plan, completedLogCount: 1);
        var lockService = LockServiceAcquired(sessionId, planId);
        var notifier = Substitute.For<IRealtimeNotifier>();

        var ep = Factory.Create<UnlockTrainingSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, lockService, DefaultOptions(), notifier);

        // Act
        await ep.HandleAsync(
            new UnlockTrainingSessionRequest { PlanId = planId, SessionId = sessionId },
            TestContext.Current.CancellationToken);

        // Assert: 409 returned for finished session
        ep.HttpContext.Response.StatusCode.Should().Be(409,
            "unlocking a finished session must return 409 SESSION_ALREADY_COMPLETED");

        // Lock was NOT acquired (finished-guard fires before AcquireAsync)
        await lockService.DidNotReceive().AcquireAsync(
            Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<Guid>(),
            Arg.Any<LockHolder>(), Arg.Any<LockType>(), Arg.Any<TimeSpan>(),
            Arg.Any<CancellationToken>());

        // No SignalR events emitted
        await notifier.DidNotReceive().NotifyAsync(
            Arg.Any<Guid>(),
            Arg.Any<string>(),
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Unlock_SessionNotCompleted_Returns204AndAcquiresLock()
    {
        // Arrange: plan exists, session exists, CountDocumentsAsync returns 0 → unlock proceeds.
        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();
        var plan = CreatePlan(planId, sessionId);

        var mongo = CreateMockMongo(plan, completedLogCount: 0);
        var lockService = LockServiceAcquired(sessionId, planId);
        var notifier = Substitute.For<IRealtimeNotifier>();

        var ep = Factory.Create<UnlockTrainingSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, lockService, DefaultOptions(), notifier);

        // Act
        await ep.HandleAsync(
            new UnlockTrainingSessionRequest { PlanId = planId, SessionId = sessionId },
            TestContext.Current.CancellationToken);

        // Assert: 204 success, lock was acquired
        ep.HttpContext.Response.StatusCode.Should().Be(204,
            "unlock on a non-finished session must succeed with 204");

        await lockService.Received(1).AcquireAsync(
            sessionId, planId, _clientId, _trainerId,
            LockHolder.Coach, LockType.Editing, Arg.Any<TimeSpan>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Unlock_PlanNotFound_Returns404_BeforeFinishedGuard()
    {
        // Arrange: query returns no plan for this trainer (ownership guard fires first with 404).
        var planId = Guid.NewGuid();
        var sessionId = Guid.NewGuid();

        // CreateMockMongo with a plan belonging to a DIFFERENT trainer — query with otherTrainerId returns nothing
        var otherTrainer = Guid.NewGuid();
        var planBelongingToOtherTrainer = CreatePlan(planId, sessionId); // uses _trainerId
        // Use the standard CreateMockMongoWithLogs which returns the plan (our endpoint filters by TrainerId in the query)
        // We need the plan NOT to be returned when queried by otherTrainerId.
        // The mongo mock returns ALL plans regardless of filter — so we create a plan with a different trainer
        // and query as if we're otherTrainer (since the plan.TrainerId != otherTrainer, the mongo filter yields empty in prod,
        // but the mock returns all). Use a separate mongo where plan collection is empty for simplicity.
        var mongo = Substitute.For<IMongoContext>();
        var emptyPlanCollection = TrainingPlanTestHelpers.CreateMockCollection([]);
        mongo.TrainingPlans.Returns(emptyPlanCollection);

        var logCollection = Substitute.For<IMongoCollection<WorkoutLog>>();
        logCollection.CountDocumentsAsync(
                Arg.Any<FilterDefinition<WorkoutLog>>(),
                Arg.Any<CountOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(0L);
        mongo.WorkoutLogs.Returns(logCollection);

        var ep = Factory.Create<UnlockTrainingSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(otherTrainer, AppRoles.Trainer))),
            mongo, Substitute.For<ISessionLockService>(), DefaultOptions(), Substitute.For<IRealtimeNotifier>());

        // Act
        await ep.HandleAsync(
            new UnlockTrainingSessionRequest { PlanId = planId, SessionId = sessionId },
            TestContext.Current.CancellationToken);

        // Assert: 404 — ownership guard fires before finished-guard
        ep.HttpContext.Response.StatusCode.Should().Be(404);

        // WorkoutLogs.CountDocumentsAsync must NOT be called (404 short-circuits before finished-guard)
        await logCollection.DidNotReceive().CountDocumentsAsync(
            Arg.Any<FilterDefinition<WorkoutLog>>(),
            Arg.Any<CountOptions>(),
            Arg.Any<CancellationToken>());
    }
}
