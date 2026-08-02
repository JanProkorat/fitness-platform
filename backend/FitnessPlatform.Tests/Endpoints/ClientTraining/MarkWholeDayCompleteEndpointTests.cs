using System.Net;
using System.Reflection;
using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientTraining.MarkWholeDayComplete;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Builders;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;
using MongoDB.Driver.Core.Clusters;
using MongoDB.Driver.Core.Connections;
using MongoDB.Driver.Core.Servers;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientTraining;

/// <summary>
/// Tests for <see cref="MarkWholeDayCompleteEndpoint"/>.
/// </summary>
public class MarkWholeDayCompleteEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly Guid _session1 = Guid.NewGuid();
    private readonly Guid _session2 = Guid.NewGuid();
    private readonly Guid _exercise1 = Guid.NewGuid();
    private readonly Guid _exercise2 = Guid.NewGuid();
    private readonly IRealtimeNotifier _notifier = TrainingCompletionTestHelpers.CreateStubNotifier();
    private readonly IComplianceService _compliance = TrainingCompletionTestHelpers.CreateStubComplianceService();
    private readonly ILogger<MarkWholeDayCompleteEndpoint> _logger = Substitute.For<ILogger<MarkWholeDayCompleteEndpoint>>();
    private readonly ISessionLockService _lockService = CreateStubLockService();
    private static readonly IOptions<TrainingLockOptions> LockOptions = Options.Create(new TrainingLockOptions { LiveTtlHours = 6 });

    private static ISessionLockService CreateStubLockService()
    {
        var svc = Substitute.For<ISessionLockService>();
        svc.GetStateAsync(Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new List<SessionLock>() as IReadOnlyList<SessionLock>);
        svc.RefreshAsync(Arg.Any<Guid>(), Arg.Any<LockType>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns(false);
        return svc;
    }

    private IApplicationDbContext CreateMockDb() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

    /// <summary>
    /// Creates a plan with two sessions on the same day of week (today).
    /// </summary>
    private TrainingPlan CreateMultiSessionPlan()
    {
        var today = DateTime.UtcNow;
        var startOfWeek = today.Date.AddDays(-(((int)today.DayOfWeek + 6) % 7)); // ISO Monday

        // ISO dow for today
        var todayDow = (int)today.DayOfWeek;
        todayDow = todayDow == 0 ? 7 : todayDow;

        return new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Multi-Session Day Plan",
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
                            SessionId = _session1,
                            DayOfWeek = todayDow,
                            Name = "Session 1",
                            Order = 1,
                            Sections =
                            [
                                new TrainingWorkout
                                {
                                    SectionId = Guid.NewGuid(),
                                    Order = 0,
                                    Name = "Hlavní",
                                    Exercises =
                                    [
                                        new SessionExercise { ExerciseExternalId = _exercise1, ExerciseName = "Ex1", Order = 1, Sets = [] }
                                    ]
                                }
                            ]
                        },
                        new TrainingSession
                        {
                            SessionId = _session2,
                            DayOfWeek = todayDow,
                            Name = "Session 2",
                            Order = 2,
                            Sections =
                            [
                                new TrainingWorkout
                                {
                                    SectionId = Guid.NewGuid(),
                                    Order = 0,
                                    Name = "Hlavní",
                                    Exercises =
                                    [
                                        new SessionExercise { ExerciseExternalId = _exercise2, ExerciseName = "Ex2", Order = 1, Sets = [] }
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
    }

    /// <summary>
    /// Creates a plan with a single session scheduled today (isolates a single
    /// session's read/write path for concurrency-scenario tests, avoiding cross-talk
    /// with a second session's mocked calls).
    /// </summary>
    private TrainingPlan CreateSingleSessionPlan(Guid sessionId, IReadOnlyList<Guid> exerciseIds)
    {
        var today = DateTime.UtcNow;
        var startOfWeek = today.Date.AddDays(-(((int)today.DayOfWeek + 6) % 7));
        var todayDow = (int)today.DayOfWeek;
        todayDow = todayDow == 0 ? 7 : todayDow;

        return new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Single-Session Day Plan",
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
                            SessionId = sessionId,
                            DayOfWeek = todayDow,
                            Name = "Session 1",
                            Order = 1,
                            Sections =
                            [
                                new TrainingWorkout
                                {
                                    SectionId = Guid.NewGuid(),
                                    Order = 0,
                                    Name = "Hlavní",
                                    Exercises = exerciseIds.Select((id, i) => new SessionExercise
                                    {
                                        ExerciseExternalId = id, ExerciseName = $"Ex{i + 1}", Order = i + 1, Sets = []
                                    }).ToList()
                                }
                            ]
                        }
                    ]
                }
            ],
            Version = 1,
            DateCreated = startOfWeek
        };
    }

    /// <summary>
    /// Builds an <see cref="IAsyncCursor{SessionExecution}"/> substitute backed by the given list —
    /// local copy of <see cref="TrainingCompletionTestHelpers"/>'s private cursor helper, needed here
    /// to stage sequential FindAsync return values (batch-read vs. duplicate-key retry-read).
    /// </summary>
    private static IAsyncCursor<SessionExecution> CreateCursor(List<SessionExecution> completions)
    {
        var cursor = Substitute.For<IAsyncCursor<SessionExecution>>();
        var moved = false;
        cursor.Current.Returns(completions);
        cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return completions.Count > 0;
        });
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
        {
            if (moved) return false;
            moved = true;
            return completions.Count > 0;
        });
        return cursor;
    }

    /// <summary>
    /// Constructs a real <see cref="MongoWriteException"/> with a duplicate-key (11000) write error,
    /// via reflection since <see cref="WriteError"/>'s constructor is internal to the driver.
    /// </summary>
    private static MongoWriteException CreateDuplicateKeyException()
    {
        var writeErrorCtor = typeof(WriteError).GetConstructor(
            BindingFlags.NonPublic | BindingFlags.Instance,
            null,
            [typeof(ServerErrorCategory), typeof(int), typeof(string), typeof(BsonDocument)],
            null)!;
        var writeError = (WriteError)writeErrorCtor.Invoke(
            [ServerErrorCategory.DuplicateKey, 11000, "E11000 duplicate key error", new BsonDocument()]);

        var serverId = new ServerId(new ClusterId(), new DnsEndPoint("localhost", 27017));
        var connectionId = new ConnectionId(serverId);

        return new MongoWriteException(connectionId, writeError, null!, null!);
    }

    [Fact]
    public async Task HandleAsync_MultipleSessions_InsertsCompletionForEach()
    {
        var plan = CreateMultiSessionPlan();
        var mongo = Substitute.For<FitnessPlatform.Application.Infrastructure.Data.MongoDb.IMongoContext>();

        // Plans collection returns the multi-session plan
        var planCollection = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan).Mongo.TrainingPlans;
        mongo.TrainingPlans.Returns(planCollection);

        // Completions collection starts empty (returns empty list for FindAsync)
        var completionCollection = TrainingCompletionTestHelpers.CreateMockSessionExecutionCollection([]);
        mongo.SessionExecutions.Returns(completionCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<MarkWholeDayCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _logger);

        await ep.HandleAsync(
            new MarkWholeDayCompleteRequest { Date = DateOnly.FromDateTime(DateTime.UtcNow) },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // Should have inserted two completion documents (one per session)
        await completionCollection.Received(2).InsertOneAsync(
            Arg.Any<SessionExecution>(),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_AlreadyCompleteSession_IsSkippedIdempotently()
    {
        var today = DateTime.UtcNow.Date;
        var plan = CreateMultiSessionPlan();

        // Session 1 is already fully complete
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _session1,
            date: today,
            completedExerciseIds: [_exercise1],
            version: 1);

        var mongo = Substitute.For<FitnessPlatform.Application.Infrastructure.Data.MongoDb.IMongoContext>();
        var planCollection = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan).Mongo.TrainingPlans;
        mongo.TrainingPlans.Returns(planCollection);

        // Completions collection returns the existing completion (for session1)
        // Note: both session queries will return the same existing completion because mock
        // doesn't filter — this tests the "already complete" idempotency branch for session1
        var completionCollection = TrainingCompletionTestHelpers.CreateMockSessionExecutionCollection([existingCompletion]);
        mongo.SessionExecutions.Returns(completionCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<MarkWholeDayCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _logger);

        await ep.HandleAsync(
            new MarkWholeDayCompleteRequest { Date = DateOnly.FromDateTime(today) },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    [Fact]
    public async Task HandleAsync_NoPlan_Returns404()
    {
        var mongo = Substitute.For<FitnessPlatform.Application.Infrastructure.Data.MongoDb.IMongoContext>();
        var planCollection = TrainingCompletionTestHelpers.CreateMockMongo().Mongo.TrainingPlans;
        mongo.TrainingPlans.Returns(planCollection);

        var completionCollection = TrainingCompletionTestHelpers.CreateMockSessionExecutionCollection([]);
        mongo.SessionExecutions.Returns(completionCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<MarkWholeDayCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _logger);

        await ep.HandleAsync(
            new MarkWholeDayCompleteRequest(),
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo();
        var db = CreateMockDb();

        var ep = Factory.Create<MarkWholeDayCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity()),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _logger);

        await ep.HandleAsync(
            new MarkWholeDayCompleteRequest(),
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    /// <summary>
    /// Regression test for #662: the completion read must be a single batched
    /// Filter.In(SessionId) round trip covering every session resolved for the day,
    /// not one FindAsync per session inside the loop.
    /// </summary>
    [Fact]
    public async Task HandleAsync_MultipleSessions_IssuesSingleBatchedFindForCompletions()
    {
        var plan = CreateMultiSessionPlan();
        var mongo = Substitute.For<IMongoContext>();

        var planCollection = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan).Mongo.TrainingPlans;
        mongo.TrainingPlans.Returns(planCollection);

        var completionCollection = TrainingCompletionTestHelpers.CreateMockSessionExecutionCollection([]);
        mongo.SessionExecutions.Returns(completionCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<MarkWholeDayCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _logger);

        await ep.HandleAsync(
            new MarkWholeDayCompleteRequest { Date = DateOnly.FromDateTime(DateTime.UtcNow) },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // Two round trips total for a two-session day: one batched Filter.In read for our
        // own completion check (this endpoint's fix), plus TrainingProgressBroadcaster's own
        // already-batched read for the compliance broadcast. Before #662 this was 3 — one
        // per-session FindAsync (2, one per session) plus the broadcaster's read (1).
        await completionCollection.Received(2).FindAsync(
            Arg.Any<FilterDefinition<SessionExecution>>(),
            Arg.Any<FindOptions<SessionExecution, SessionExecution>>(),
            Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// Fan-out version conflict: another request bumped the session's Version between
    /// our batched read and our per-session UpdateOneAsync, so the version-matched filter
    /// modifies zero rows. The session is skipped (existing version reported back) but the
    /// whole request must still succeed — it must not fail the entire day's batch.
    /// </summary>
    [Fact]
    public async Task HandleAsync_FanOutVersionConflict_SkipsSessionWithoutFailingRequest()
    {
        var plan = CreateMultiSessionPlan();

        // Session1 has a partial completion; UpdateOneAsync is stubbed to modify zero rows,
        // simulating a concurrent writer winning the race after our batch read.
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _session1,
            date: DateTime.UtcNow.Date,
            completedExerciseIds: [],
            version: 3);

        var mongo = Substitute.For<IMongoContext>();
        var planCollection = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan).Mongo.TrainingPlans;
        mongo.TrainingPlans.Returns(planCollection);

        var completionCollection = TrainingCompletionTestHelpers.CreateMockSessionExecutionCollection(
            [existingCompletion], updateSucceeds: false);
        mongo.SessionExecutions.Returns(completionCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<MarkWholeDayCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _logger);

        await ep.HandleAsync(
            new MarkWholeDayCompleteRequest { Date = DateOnly.FromDateTime(DateTime.UtcNow) },
            TestContext.Current.CancellationToken);

        // The whole batch still succeeds even though session1's write lost the race.
        ep.HttpContext.Response.StatusCode.Should().Be(200);

        var session1Summary = ep.Response.Sessions.Single(s => s.SessionId == _session1);
        session1Summary.Version.Should().Be(3); // kept the existing version, not incremented
    }

    /// <summary>
    /// Duplicate-key (Mongo 11000) on concurrent insert: a concurrent request inserts the
    /// completion doc first, so our InsertOneAsync fails with a 11000 write error. The
    /// handler must re-read the doc and retry the fan-out once, still returning 200.
    /// </summary>
    [Fact]
    public async Task HandleAsync_DuplicateKeyOnConcurrentInsert_RetriesAndSucceeds()
    {
        var plan = CreateSingleSessionPlan(_session1, [_exercise1, _exercise2]);

        var mongo = Substitute.For<IMongoContext>();
        var planCollection = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan).Mongo.TrainingPlans;
        mongo.TrainingPlans.Returns(planCollection);

        // The concurrent request's winning doc: only exercise1 completed so far.
        var winnerCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _session1,
            date: DateTime.UtcNow.Date,
            completedExerciseIds: [_exercise1],
            version: 1);

        var completionCollection = Substitute.For<IMongoCollection<SessionExecution>>();

        // Batch read (before the insert race) sees nothing yet; the retry read after the
        // 11000 sees the concurrent winner's doc.
        completionCollection.FindAsync(
                Arg.Any<FilterDefinition<SessionExecution>>(),
                Arg.Any<FindOptions<SessionExecution, SessionExecution>>(),
                Arg.Any<CancellationToken>())
            .Returns(
                _ => CreateCursor([]),
                _ => CreateCursor([winnerCompletion]));

        completionCollection
            .InsertOneAsync(Arg.Any<SessionExecution>(), Arg.Any<InsertOneOptions>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException(CreateDuplicateKeyException()));

        var updateResult = Substitute.For<UpdateResult>();
        updateResult.ModifiedCount.Returns(1L);
        completionCollection.UpdateOneAsync(
                Arg.Any<FilterDefinition<SessionExecution>>(),
                Arg.Any<UpdateDefinition<SessionExecution>>(),
                Arg.Any<UpdateOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(updateResult);

        mongo.SessionExecutions.Returns(completionCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<MarkWholeDayCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _logger);

        await ep.HandleAsync(
            new MarkWholeDayCompleteRequest { Date = DateOnly.FromDateTime(DateTime.UtcNow) },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // Retried after the duplicate-key error, found the winner's doc (only exercise1
        // complete), and fanned out the remaining exercise via an update — not a second insert.
        await completionCollection.Received(1).InsertOneAsync(
            Arg.Any<SessionExecution>(), Arg.Any<InsertOneOptions>(), Arg.Any<CancellationToken>());
        await completionCollection.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<SessionExecution>>(),
            Arg.Any<UpdateDefinition<SessionExecution>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());

        ep.Response.Sessions.Single().Version.Should().Be(2);
    }

    /// <summary>
    /// Empty day: no sessions resolved for the date. Must return empty summaries without
    /// issuing the batch completion read or firing the whole-day broadcast.
    /// </summary>
    [Fact]
    public async Task HandleAsync_EmptyDay_ReturnsEmptySummariesWithoutBroadcasting()
    {
        var start = TrainingCompletionTestHelpers.StartOfCurrentWeekUtc();
        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "No Sessions Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = start,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = start,
                    Sessions = []
                }
            ],
            Version = 1,
            DateCreated = start
        };

        var mongo = Substitute.For<IMongoContext>();
        var planCollection = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan).Mongo.TrainingPlans;
        mongo.TrainingPlans.Returns(planCollection);

        var completionCollection = TrainingCompletionTestHelpers.CreateMockSessionExecutionCollection([]);
        mongo.SessionExecutions.Returns(completionCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<MarkWholeDayCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _logger);

        await ep.HandleAsync(
            new MarkWholeDayCompleteRequest { Date = DateOnly.FromDateTime(DateTime.UtcNow) },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.Sessions.Should().BeEmpty();

        // No completion read should happen when there's nothing to resolve for the day,
        // and no realtime broadcast should fire.
        await completionCollection.DidNotReceive().FindAsync(
            Arg.Any<FilterDefinition<SessionExecution>>(),
            Arg.Any<FindOptions<SessionExecution, SessionExecution>>(),
            Arg.Any<CancellationToken>());
        await _notifier.DidNotReceive().NotifyAsync(
            Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<object>(), Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// Regression test for #739: the whole-day mark must write the per-section
    /// attribution map (<c>CompletedExerciseIdsBySection</c>), not just the flat
    /// <c>CompletedExerciseIds</c>. When an exercise is shared across two sections
    /// (e.g. "Bench" in both a Standard block and an AMRAP), the read-time backfill
    /// (<c>TrainingCompletionBackfill</c>) would otherwise credit it to only the
    /// first section — leaving the second section reading as not-done after refresh.
    /// The written map must credit the shared exercise to EVERY section that contains it.
    /// </summary>
    [Fact]
    public async Task HandleAsync_ExerciseSharedAcrossSections_WritesSharedExerciseToEverySection()
    {
        var sharedExercise = Guid.NewGuid();
        var exA = Guid.NewGuid();
        var exB = Guid.NewGuid();
        var sectionA = Guid.NewGuid();
        var sectionB = Guid.NewGuid();

        var today = DateTime.UtcNow;
        var startOfWeek = today.Date.AddDays(-(((int)today.DayOfWeek + 6) % 7));
        var todayDow = (int)today.DayOfWeek;
        todayDow = todayDow == 0 ? 7 : todayDow;

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Shared-Exercise Day Plan",
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
                            SessionId = _session1,
                            DayOfWeek = todayDow,
                            Name = "Shared session",
                            Order = 1,
                            Sections =
                            [
                                new TrainingWorkout
                                {
                                    SectionId = sectionA,
                                    Order = 0,
                                    Name = "Standard",
                                    Exercises =
                                    [
                                        new SessionExercise { ExerciseExternalId = sharedExercise, ExerciseName = "Bench", Order = 1, Sets = [] },
                                        new SessionExercise { ExerciseExternalId = exA, ExerciseName = "Pec deck", Order = 2, Sets = [] }
                                    ]
                                },
                                new TrainingWorkout
                                {
                                    SectionId = sectionB,
                                    Order = 1,
                                    Name = "AMRAP",
                                    Exercises =
                                    [
                                        new SessionExercise { ExerciseExternalId = sharedExercise, ExerciseName = "Bench", Order = 1, Sets = [] },
                                        new SessionExercise { ExerciseExternalId = exB, ExerciseName = "Shyb", Order = 2, Sets = [] }
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
        var planCollection = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan).Mongo.TrainingPlans;
        mongo.TrainingPlans.Returns(planCollection);

        var completionCollection = TrainingCompletionTestHelpers.CreateMockSessionExecutionCollection([]);
        mongo.SessionExecutions.Returns(completionCollection);

        SessionExecution? inserted = null;
        completionCollection
            .When(x => x.InsertOneAsync(Arg.Any<SessionExecution>(), Arg.Any<InsertOneOptions>(), Arg.Any<CancellationToken>()))
            .Do(ci => inserted = ci.Arg<SessionExecution>());

        var db = CreateMockDb();

        var ep = Factory.Create<MarkWholeDayCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _logger);

        await ep.HandleAsync(
            new MarkWholeDayCompleteRequest { Date = DateOnly.FromDateTime(DateTime.UtcNow) },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        inserted.Should().NotBeNull();
        inserted!.CompletedExerciseIdsBySection.Should().NotBeNull();
        // Both sections must be present as keys.
        inserted.CompletedExerciseIdsBySection!.Keys.Should()
            .BeEquivalentTo([sectionA.ToString(), sectionB.ToString()]);
        // Section A carries the shared exercise + its own.
        inserted.CompletedExerciseIdsBySection[sectionA.ToString()].Should()
            .BeEquivalentTo([sharedExercise, exA]);
        // Section B ALSO carries the shared exercise (the bug: it used to be lost). + its own.
        inserted.CompletedExerciseIdsBySection[sectionB.ToString()].Should()
            .BeEquivalentTo([sharedExercise, exB]);
    }
}
