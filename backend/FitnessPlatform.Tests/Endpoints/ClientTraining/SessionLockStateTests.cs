using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientTraining.GetTodaySession;
using FitnessPlatform.Application.Features.ClientTraining.MarkExerciseComplete;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Builders;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientTraining;

/// <summary>
/// Tests for session lock state enrichment and TTL refresh behaviour (issue #382).
/// </summary>
public class SessionLockStateTests
{
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _sessionId = Guid.NewGuid();

    private static int TodayDow()
    {
        var dow = (int)DateTime.UtcNow.DayOfWeek;
        return dow == 0 ? 7 : dow;
    }

    private static DateTime StartOfCurrentWeek()
    {
        var today = DateTime.UtcNow.Date;
        return today.AddDays(-(((int)today.DayOfWeek + 6) % 7));
    }

    private IOptions<TrainingLockOptions> DefaultLockOptions() =>
        Options.Create(new TrainingLockOptions { LiveTtlHours = 6, EditingTtlHours = 2 });

    // ── GetTodaySession lock state enrichment ─────────────────────────────────

    private IMongoContext CreateMongoForTodaySession(
        TrainingPlan plan,
        IReadOnlyList<SessionLock>? locks = null)
    {
        // Delegate to the existing helper pattern used across GetTodaySession tests
        var mongo = Substitute.For<IMongoContext>();

        // Training plans
        var planCollection = Substitute.For<IMongoCollection<TrainingPlan>>();
        planCollection.FindAsync(
                Arg.Any<FilterDefinition<TrainingPlan>>(),
                Arg.Any<FindOptions<TrainingPlan, TrainingPlan>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                var plans = new List<TrainingPlan> { plan };
                var cursor = Substitute.For<IAsyncCursor<TrainingPlan>>();
                var moved = false;
                cursor.Current.Returns(plans);
                cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ => { if (moved) return false; moved = true; return true; });
                cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ => { if (moved) return false; moved = true; return true; });
                return cursor;
            });
        mongo.TrainingPlans.Returns(planCollection);

        // Exercises (empty)
        var exerciseCollection = Substitute.For<IMongoCollection<Exercise>>();
        exerciseCollection.FindAsync(
                Arg.Any<FilterDefinition<Exercise>>(),
                Arg.Any<FindOptions<Exercise, Exercise>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                var cursor = Substitute.For<IAsyncCursor<Exercise>>();
                cursor.Current.Returns(new List<Exercise>());
                cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(false);
                cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(false);
                return cursor;
            });
        mongo.Exercises.Returns(exerciseCollection);

        // TrainingCompletions (empty)
        var completionCollection = Substitute.For<IMongoCollection<TrainingCompletion>>();
        completionCollection.FindAsync(
                Arg.Any<FilterDefinition<TrainingCompletion>>(),
                Arg.Any<FindOptions<TrainingCompletion, TrainingCompletion>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                var cursor = Substitute.For<IAsyncCursor<TrainingCompletion>>();
                cursor.Current.Returns(new List<TrainingCompletion>());
                cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(false);
                cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(false);
                return cursor;
            });
        mongo.TrainingCompletions.Returns(completionCollection);

        // WorkoutLogs (empty)
        var logCollection = Substitute.For<IMongoCollection<WorkoutLog>>();
        logCollection.FindAsync(
                Arg.Any<FilterDefinition<WorkoutLog>>(),
                Arg.Any<FindOptions<WorkoutLog, WorkoutLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                var cursor = Substitute.For<IAsyncCursor<WorkoutLog>>();
                cursor.Current.Returns(new List<WorkoutLog>());
                cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(false);
                cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(false);
                return cursor;
            });
        mongo.WorkoutLogs.Returns(logCollection);

        return mongo;
    }

    private ISessionLockService LockServiceWithDocs(IReadOnlyList<SessionLock> docs)
    {
        var svc = Substitute.For<ISessionLockService>();
        svc.GetStateAsync(Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(docs);
        return svc;
    }

    [Fact]
    public async Task GetTodaySession_WithLiveLock_ResponseContainsLockStateAndHolder()
    {
        // Arrange — today has one session, that session has a Live lock held by Client
        var startOfWeek = StartOfCurrentWeek();
        var todayDow = TodayDow();
        var planId = Guid.NewGuid();

        var plan = new TrainingPlan
        {
            ExternalId = planId,
            ClientId = _clientId,
            TrainerId = _trainerId,
            Name = "Live Lock Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = startOfWeek,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = startOfWeek,
                    Sessions =
                    [
                        new TrainingSession
                        {
                            SessionId = _sessionId,
                            DayOfWeek = todayDow,
                            Name = "Push Day",
                            Order = 1,
                            Sections = []
                        }
                    ]
                }
            ],
            Version = 1,
            DateCreated = startOfWeek
        };

        var liveLock = new SessionLock
        {
            SessionId = _sessionId,
            PlanId = planId,
            ClientId = _clientId,
            TrainerId = _trainerId,
            Holder = LockHolder.Client,
            Type = LockType.Live,
            AcquiredAt = DateTime.UtcNow.AddMinutes(-10),
            ExpiresAt = DateTime.UtcNow.AddHours(6)
        };

        var lockService = LockServiceWithDocs(new List<SessionLock> { liveLock });
        var mongo = CreateMongoForTodaySession(plan);
        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

        var ep = Factory.Create<GetTodaySessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, lockService);

        // Act
        await ep.HandleAsync(TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.HasSession.Should().BeTrue();

        ep.Response.LockStateBySession.Should().ContainKey(_sessionId);
        ep.Response.LockStateBySession[_sessionId].Should().Be("Live");
        ep.Response.LockHolderBySession.Should().ContainKey(_sessionId);
        ep.Response.LockHolderBySession[_sessionId].Should().Be("Client");
    }

    [Fact]
    public async Task GetTodaySession_NoLock_LockStateFieldsAbsent()
    {
        // Arrange — today has one session but no lock document
        var startOfWeek = StartOfCurrentWeek();
        var todayDow = TodayDow();

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = _trainerId,
            Name = "Stable Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = startOfWeek,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = startOfWeek,
                    Sessions =
                    [
                        new TrainingSession
                        {
                            SessionId = _sessionId,
                            DayOfWeek = todayDow,
                            Name = "Pull Day",
                            Order = 1,
                            Sections = []
                        }
                    ]
                }
            ],
            Version = 1,
            DateCreated = startOfWeek
        };

        // No lock documents — session is Stable
        var lockService = LockServiceWithDocs(new List<SessionLock>());
        var mongo = CreateMongoForTodaySession(plan);
        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

        var ep = Factory.Create<GetTodaySessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, lockService);

        // Act
        await ep.HandleAsync(TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.HasSession.Should().BeTrue();

        // Stable sessions have no entry in the dicts (treated as Stable by the client)
        ep.Response.LockStateBySession.Should().NotContainKey(_sessionId);
        ep.Response.LockHolderBySession.Should().NotContainKey(_sessionId);
    }

    // ── MarkExerciseComplete TTL refresh ──────────────────────────────────────

    [Fact]
    public async Task MarkExerciseComplete_CallsRefreshAsync_BeforeProcessing()
    {
        // Arrange — minimal plan/session/exercise setup; only verify RefreshAsync is called
        var startOfWeek = StartOfCurrentWeek();
        var todayDow = TodayDow();
        var sectionId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = _trainerId,
            Name = "Refresh Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = startOfWeek,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = startOfWeek,
                    Sessions =
                    [
                        new TrainingSession
                        {
                            SessionId = _sessionId,
                            DayOfWeek = todayDow,
                            Name = "Refresh Day",
                            Order = 1,
                            Sections =
                            [
                                new TrainingSection
                                {
                                    SectionId = sectionId,
                                    Order = 0,
                                    Name = "Hlavní",
                                    Exercises =
                                    [
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = exerciseId,
                                            ExerciseName = "Squat",
                                            Order = 1,
                                            Sets = [new ExerciseSet { SetNumber = 1 }]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ],
            Version = 1,
            DateCreated = startOfWeek
        };

        var mongo = Substitute.For<IMongoContext>();

        // Plan cursor
        var planCollection = Substitute.For<IMongoCollection<TrainingPlan>>();
        planCollection.FindAsync(
                Arg.Any<FilterDefinition<TrainingPlan>>(),
                Arg.Any<FindOptions<TrainingPlan, TrainingPlan>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                var plans = new List<TrainingPlan> { plan };
                var cursor = Substitute.For<IAsyncCursor<TrainingPlan>>();
                var moved = false;
                cursor.Current.Returns(plans);
                cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ => { if (moved) return false; moved = true; return true; });
                cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ => { if (moved) return false; moved = true; return true; });
                return cursor;
            });
        mongo.TrainingPlans.Returns(planCollection);

        // Completions cursor (empty — triggers InsertOneAsync)
        var completionCollection = Substitute.For<IMongoCollection<TrainingCompletion>>();
        completionCollection.FindAsync(
                Arg.Any<FilterDefinition<TrainingCompletion>>(),
                Arg.Any<FindOptions<TrainingCompletion, TrainingCompletion>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                var cursor = Substitute.For<IAsyncCursor<TrainingCompletion>>();
                cursor.Current.Returns(new List<TrainingCompletion>());
                cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(false);
                cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(false);
                return cursor;
            });
        mongo.TrainingCompletions.Returns(completionCollection);

        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

        var notifier = Substitute.For<IRealtimeNotifier>();
        var compliance = Substitute.For<IComplianceService>();
        var lockService = Substitute.For<ISessionLockService>();
        lockService.RefreshAsync(Arg.Any<Guid>(), Arg.Any<LockType>(), Arg.Any<TimeSpan>(),
            Arg.Any<CancellationToken>()).Returns(false); // no live lock — safe no-op

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, notifier, compliance, lockService, DefaultLockOptions(),
            NullLogger<MarkExerciseCompleteEndpoint>.Instance);

        var req = new MarkExerciseCompleteRequest
        {
            SessionId = _sessionId,
            SectionId = sectionId,
            ExerciseExternalId = exerciseId
        };

        // Act
        await ep.HandleAsync(req, TestContext.Current.CancellationToken);

        // Assert
        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // RefreshAsync must have been called with the session's id and Live type
        await lockService.Received(1).RefreshAsync(
            _sessionId, LockType.Live,
            TimeSpan.FromHours(6),
            Arg.Any<CancellationToken>());
    }
}
