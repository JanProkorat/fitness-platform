using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientTraining.GetTodaySession;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientTraining;

/// <summary>
/// Tests for <see cref="GetTodaySessionEndpoint"/>.
/// </summary>
public class GetTodaySessionEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();

    private IApplicationDbContext CreateMockDb() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

    /// <summary>
    /// Computes today's ISO day-of-week (1 = Monday, 7 = Sunday).
    /// </summary>
    private static int TodayDow()
    {
        var dow = (int)DateTime.UtcNow.DayOfWeek;
        return dow == 0 ? 7 : dow;
    }

    /// <summary>
    /// Returns the Monday of the current week (UTC).
    /// </summary>
    private static DateTime StartOfCurrentWeek()
    {
        var today = DateTime.UtcNow.Date;
        return today.AddDays(-(((int)today.DayOfWeek + 6) % 7));
    }

    private IMongoContext CreateMongoWithPlan(
        TrainingPlan? plan,
        List<Exercise>? exercises = null,
        List<TrainingCompletion>? completions = null,
        List<WorkoutLog>? workoutLogs = null)
    {
        var plans = plan is not null ? new List<TrainingPlan> { plan } : new List<TrainingPlan>();
        return CreateMongoWithPlans(plans, exercises, completions, workoutLogs);
    }

    /// <summary>
    /// Same as <see cref="CreateMongoWithPlan"/> but seeds multiple plans for the client —
    /// used to test the date-window-aware resolver (#780) with >1 Active plan.
    /// </summary>
    private IMongoContext CreateMongoWithPlans(
        List<TrainingPlan> plans,
        List<Exercise>? exercises = null,
        List<TrainingCompletion>? completions = null,
        List<WorkoutLog>? workoutLogs = null)
    {
        var mongo = Substitute.For<IMongoContext>();

        var planCollection = Substitute.For<IMongoCollection<TrainingPlan>>();
        planCollection.FindAsync(
                Arg.Any<FilterDefinition<TrainingPlan>>(),
                Arg.Any<FindOptions<TrainingPlan, TrainingPlan>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                var cursor = Substitute.For<IAsyncCursor<TrainingPlan>>();
                var moved = false;
                cursor.Current.Returns(plans);
                cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
                {
                    if (moved) return false;
                    moved = true;
                    return plans.Count > 0;
                });
                cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
                {
                    if (moved) return false;
                    moved = true;
                    return plans.Count > 0;
                });
                return cursor;
            });

        mongo.TrainingPlans.Returns(planCollection);

        // Stub the Exercises collection so the enrichment path doesn't blow up.
        var exerciseDocs = exercises ?? [];
        var exerciseCollection = Substitute.For<IMongoCollection<Exercise>>();
        exerciseCollection.FindAsync(
                Arg.Any<FilterDefinition<Exercise>>(),
                Arg.Any<FindOptions<Exercise, Exercise>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                var cursor = Substitute.For<IAsyncCursor<Exercise>>();
                var moved = false;
                cursor.Current.Returns(exerciseDocs);
                cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
                {
                    if (moved) return false;
                    moved = true;
                    return exerciseDocs.Count > 0;
                });
                cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
                {
                    if (moved) return false;
                    moved = true;
                    return exerciseDocs.Count > 0;
                });
                return cursor;
            });

        mongo.Exercises.Returns(exerciseCollection);

        // Stub the TrainingCompletions collection.
        var completionDocs = completions ?? [];
        var completionCollection = Substitute.For<IMongoCollection<TrainingCompletion>>();
        completionCollection.FindAsync(
                Arg.Any<FilterDefinition<TrainingCompletion>>(),
                Arg.Any<FindOptions<TrainingCompletion, TrainingCompletion>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                var cursor = Substitute.For<IAsyncCursor<TrainingCompletion>>();
                var moved = false;
                cursor.Current.Returns(completionDocs);
                cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
                {
                    if (moved) return false;
                    moved = true;
                    return completionDocs.Count > 0;
                });
                cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
                {
                    if (moved) return false;
                    moved = true;
                    return completionDocs.Count > 0;
                });
                return cursor;
            });

        mongo.TrainingCompletions.Returns(completionCollection);

        // Stub the WorkoutLogs collection — the endpoint calls .Find().ToListAsync()
        // which internally dispatches to FindAsync on the collection.
        var logDocs = workoutLogs ?? [];
        var logCollection = Substitute.For<IMongoCollection<WorkoutLog>>();
        logCollection.FindAsync(
                Arg.Any<FilterDefinition<WorkoutLog>>(),
                Arg.Any<FindOptions<WorkoutLog, WorkoutLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                var cursor = Substitute.For<IAsyncCursor<WorkoutLog>>();
                var moved = false;
                cursor.Current.Returns(logDocs);
                cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
                {
                    if (moved) return false;
                    moved = true;
                    return logDocs.Count > 0;
                });
                cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
                {
                    if (moved) return false;
                    moved = true;
                    return logDocs.Count > 0;
                });
                return cursor;
            });
        mongo.WorkoutLogs.Returns(logCollection);

        // Stub the SessionLogs collection — used by the PhotosBySession enrichment path.
        // The endpoint calls .Find().ToListAsync() which internally dispatches to FindAsync.
        var sessionLogCollection = Substitute.For<IMongoCollection<SessionLog>>();
        sessionLogCollection.FindAsync(
                Arg.Any<FilterDefinition<SessionLog>>(),
                Arg.Any<FindOptions<SessionLog, SessionLog>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                var cursor = Substitute.For<IAsyncCursor<SessionLog>>();
                var moved = false;
                var emptyLogs = new List<SessionLog>();
                cursor.Current.Returns(emptyLogs);
                cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
                {
                    if (moved) return false;
                    moved = true;
                    return false; // always empty in baseline tests
                });
                cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
                {
                    if (moved) return false;
                    moved = true;
                    return false;
                });
                return cursor;
            });
        mongo.SessionLogs.Returns(sessionLogCollection);

        // SessionExecutions (#841) — GetTodaySessionEndpoint reads this collection
        // exclusively; the retired TrainingCompletions/WorkoutLogs collections stubbed
        // above are no longer consulted by the endpoint (kept for legacy call-site
        // compatibility only). Merge the completions + workoutLogs fixtures into the
        // unified per-(sessionId, date) documents the real --migrate-session-executions
        // migration would have produced.
        var executionDocs = BuildSessionExecutions(completions, workoutLogs);
        var executionCollection = Substitute.For<IMongoCollection<SessionExecution>>();
        executionCollection.FindAsync(
                Arg.Any<FilterDefinition<SessionExecution>>(),
                Arg.Any<FindOptions<SessionExecution, SessionExecution>>(),
                Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                var cursor = Substitute.For<IAsyncCursor<SessionExecution>>();
                var moved = false;
                cursor.Current.Returns(executionDocs);
                cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(_ =>
                {
                    if (moved) return false;
                    moved = true;
                    return executionDocs.Count > 0;
                });
                cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(_ =>
                {
                    if (moved) return false;
                    moved = true;
                    return executionDocs.Count > 0;
                });
                return cursor;
            });
        mongo.SessionExecutions.Returns(executionCollection);

        return mongo;
    }

    /// <summary>
    /// Merges legacy <see cref="TrainingCompletion"/> (checkbox) and <see cref="WorkoutLog"/>
    /// (Performance) fixtures into the unified <see cref="SessionExecution"/> shape, keyed by
    /// (SessionId, Date) — mirroring the real <c>--migrate-session-executions</c> merge (#841).
    /// A fixture set containing two documents for the SAME (SessionId, Date) key is not a valid
    /// input here: the partial-unique index on <c>SessionExecutions</c> guarantees at most one
    /// execution per planned session per calendar day in production, so tests exercising that
    /// scenario were retired along with the dual-collection model — see the removed
    /// "stale/multiple WorkoutLogs" tests in this file's git history.
    /// </summary>
    private static List<SessionExecution> BuildSessionExecutions(
        List<TrainingCompletion>? completions,
        List<WorkoutLog>? workoutLogs)
    {
        var executions = new Dictionary<(Guid SessionId, DateTime Date), SessionExecution>();

        foreach (var log in workoutLogs ?? [])
        {
            var converted = TrainingCompletionTestHelpers.ToSessionExecution(log);
            executions[(converted.SessionId!.Value, converted.Date)] = converted;
        }

        foreach (var completion in completions ?? [])
        {
            var key = (completion.SessionId, completion.Date);
            if (executions.TryGetValue(key, out var existing))
            {
                // Merge the checkbox fields onto the Performance-bearing document from
                // workoutLogs — same key means the real migration would have produced one doc.
                existing.CompletedExerciseIds = completion.CompletedExerciseIds;
                existing.CompletedExerciseIdsBySection = completion.CompletedExerciseIdsBySection;
                existing.CompletedSectionIds = completion.CompletedSectionIds;
                existing.CompletedSets = completion.CompletedSets;
            }
            else
            {
                executions[key] = new SessionExecution
                {
                    ExternalId = completion.ExternalId,
                    ClientId = completion.ClientId,
                    SessionId = completion.SessionId,
                    Date = completion.Date,
                    Status = SessionExecutionStatus.Partial,
                    CompletedExerciseIds = completion.CompletedExerciseIds,
                    CompletedExerciseIdsBySection = completion.CompletedExerciseIdsBySection,
                    CompletedSectionIds = completion.CompletedSectionIds,
                    CompletedSets = completion.CompletedSets,
                    DateCreated = completion.DateCreated,
                    DateUpdated = completion.DateUpdated,
                    Version = completion.Version
                };
            }
        }

        return executions.Values.ToList();
    }

    private static ISessionLockService CreateStubLockService()
    {
        var svc = Substitute.For<ISessionLockService>();
        svc.GetStateAsync(Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new List<SessionLock>() as IReadOnlyList<SessionLock>);
        return svc;
    }

    private GetTodaySessionEndpoint CreateEndpoint(IMongoContext mongo, IApplicationDbContext db) =>
        Factory.Create<GetTodaySessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, CreateStubLockService());

    // -------------------------------------------------------------------------
    // #780 — date-window-aware plan resolution (multiple Active plans per client)
    // -------------------------------------------------------------------------

    /// <summary>
    /// Builds a minimal Active plan with a single session scheduled for today, anchored to
    /// the given week-1 start date.
    /// </summary>
    private TrainingPlan BuildActivePlan(DateTime startDate, int weekCount, string name, out Guid sessionId)
    {
        var todayDow = TodayDow();
        sessionId = Guid.NewGuid();
        var capturedSessionId = sessionId; // 'out' params can't be captured in a lambda

        return new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = name,
            Status = TrainingPlanStatus.Active,
            StartDate = startDate,
            Weeks = Enumerable.Range(1, weekCount).Select(w => new TrainingWeek
            {
                WeekNumber = w,
                Status = WeekStatus.Published,
                DatePublished = startDate,
                Sessions = w == 1
                    ?
                    [
                        new TrainingSession
                        {
                            SessionId = capturedSessionId,
                            DayOfWeek = todayDow,
                            Name = name + " Session",
                            Order = 1,
                            Sections = []
                        }
                    ]
                    : []
            }).ToList(),
            Version = 1,
            DateCreated = startDate
        };
    }

    /// <summary>
    /// Regression guard for #780: with two non-overlapping Active plans (one whose window
    /// already ended, one whose window contains today), the endpoint must resolve the
    /// in-window plan deterministically — regardless of which order Mongo returns the
    /// documents in (an arbitrary FirstOrDefault would be order-dependent and wrong once
    /// more than one Active plan exists for the client).
    /// </summary>
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task HandleAsync_TwoNonOverlappingActivePlans_ReturnsInWindowPlanRegardlessOfMongoOrder(
        bool reversedOrder)
    {
        var todayStart = StartOfCurrentWeek();

        // Past plan: fully elapsed window, ended well before today.
        var pastPlan = BuildActivePlan(todayStart.AddDays(-60), weekCount: 2, name: "Past Plan", out _);
        // Current plan: window contains today (started this week).
        var currentPlan = BuildActivePlan(todayStart, weekCount: 2, name: "Current Plan", out var currentSessionId);

        var plans = reversedOrder
            ? new List<TrainingPlan> { currentPlan, pastPlan }
            : new List<TrainingPlan> { pastPlan, currentPlan };

        var mongo = CreateMongoWithPlans(plans);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.PlanId.Should().Be(currentPlan.ExternalId,
            "the resolver must pick the plan whose window contains today, not an arbitrary one");
        ep.Response.HasSession.Should().BeTrue();
#pragma warning disable CS0618
        ep.Response.Session!.SessionId.Should().Be(currentSessionId);
#pragma warning restore CS0618
    }

    /// <summary>
    /// Regression guard for #780: when a client's only Active plans are entirely in the
    /// past or entirely in the future (no plan's window contains today), the endpoint must
    /// surface the existing "no plan for today" state (HasSession=false, PlanId=null) —
    /// NOT fall back to an arbitrary Active plan.
    /// </summary>
    [Fact]
    public async Task HandleAsync_NoActivePlanWindowContainsToday_ReturnsNoPlanState()
    {
        var todayStart = StartOfCurrentWeek();

        // Both plans' windows are fully in the past or fully in the future — neither
        // contains today.
        var pastPlan = BuildActivePlan(todayStart.AddDays(-60), weekCount: 2, name: "Past Plan", out _);
        var futurePlan = BuildActivePlan(todayStart.AddDays(60), weekCount: 2, name: "Future Plan", out _);

        var mongo = CreateMongoWithPlans([pastPlan, futurePlan]);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.HasSession.Should().BeFalse();
        ep.Response.PlanId.Should().BeNull("no Active plan's window contains today — must not fall back to an arbitrary plan");
    }

    // -------------------------------------------------------------------------
    // Multi-session tests
    // -------------------------------------------------------------------------

    [Fact]
    public async Task HandleAsync_TwoSessionsOnSameDay_ReturnsBothInOrder()
    {
        var todayDow = TodayDow();
        var startOfWeek = StartOfCurrentWeek();
        var session1Id = Guid.NewGuid();
        var session2Id = Guid.NewGuid();

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Multi-Session Plan",
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
                            SessionId = session1Id,
                            DayOfWeek = todayDow,
                            Name = "Morning Session",
                            Order = 1,
                            Sections = []
                        },
                        new TrainingSession
                        {
                            SessionId = session2Id,
                            DayOfWeek = todayDow,
                            Name = "Evening Session",
                            Order = 2,
                            Sections = []
                        }
                    ]
                }
            ],
            Version = 1,
            DateCreated = startOfWeek
        };

        var mongo = CreateMongoWithPlan(plan);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        var response = ep.Response;
        response.HasSession.Should().BeTrue();
        response.Sessions.Should().HaveCount(2);
        response.Sessions[0].SessionId.Should().Be(session1Id);
        response.Sessions[0].Name.Should().Be("Morning Session");
        response.Sessions[0].Order.Should().Be(1);
        response.Sessions[1].SessionId.Should().Be(session2Id);
        response.Sessions[1].Name.Should().Be("Evening Session");
        response.Sessions[1].Order.Should().Be(2);

        // Backwards-compat: Session mirrors Sessions[0]
#pragma warning disable CS0618
        response.Session.Should().NotBeNull();
        response.Session!.SessionId.Should().Be(session1Id);
#pragma warning restore CS0618
    }

    [Fact]
    public async Task HandleAsync_TwoSessionsOnSameDay_OrderedByOrder()
    {
        var todayDow = TodayDow();
        var startOfWeek = StartOfCurrentWeek();
        var sessionAId = Guid.NewGuid();
        var sessionBId = Guid.NewGuid();

        // Intentionally store in reverse Order to verify sorting
        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Reverse Order Plan",
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
                            SessionId = sessionBId,
                            DayOfWeek = todayDow,
                            Name = "Second Session",
                            Order = 2,
                            Sections = []
                        },
                        new TrainingSession
                        {
                            SessionId = sessionAId,
                            DayOfWeek = todayDow,
                            Name = "First Session",
                            Order = 1,
                            Sections = []
                        }
                    ]
                }
            ],
            Version = 1,
            DateCreated = startOfWeek
        };

        var mongo = CreateMongoWithPlan(plan);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        var response = ep.Response;
        response.Sessions.Should().HaveCount(2);
        response.Sessions[0].SessionId.Should().Be(sessionAId, "Order=1 session must come first");
        response.Sessions[1].SessionId.Should().Be(sessionBId, "Order=2 session must come second");

#pragma warning disable CS0618
        response.Session!.SessionId.Should().Be(sessionAId, "Session must mirror Sessions[0]");
#pragma warning restore CS0618
    }

    // -------------------------------------------------------------------------
    // Single-session (backwards compatibility)
    // -------------------------------------------------------------------------

    [Fact]
    public async Task HandleAsync_SingleSessionToday_ReturnsSingleItemInSessionsAndMirrorsSession()
    {
        var todayDow = TodayDow();
        var startOfWeek = StartOfCurrentWeek();
        var sessionId = Guid.NewGuid();

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Single Session Plan",
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
                            Name = "Only Session",
                            Order = 1,
                            Sections = []
                        }
                    ]
                }
            ],
            Version = 1,
            DateCreated = startOfWeek
        };

        var mongo = CreateMongoWithPlan(plan);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        var response = ep.Response;
        response.HasSession.Should().BeTrue();
        response.Sessions.Should().HaveCount(1);
        response.Sessions[0].SessionId.Should().Be(sessionId);

#pragma warning disable CS0618
        response.Session.Should().NotBeNull();
        response.Session!.SessionId.Should().Be(sessionId);
#pragma warning restore CS0618
    }

    // -------------------------------------------------------------------------
    // No-session / empty cases
    // -------------------------------------------------------------------------

    [Fact]
    public async Task HandleAsync_NoSessionToday_HasSessionFalseAndEmptyList()
    {
        var todayDow = TodayDow();
        // Pick a different day so no session falls on today
        var otherDow = todayDow == 1 ? 2 : 1;
        var startOfWeek = StartOfCurrentWeek();

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Rest Day Plan",
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
                            SessionId = Guid.NewGuid(),
                            DayOfWeek = otherDow,
                            Name = "Not Today",
                            Order = 1,
                            Sections = []
                        }
                    ]
                }
            ],
            Version = 1,
            DateCreated = startOfWeek
        };

        var mongo = CreateMongoWithPlan(plan);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        var response = ep.Response;
        response.HasSession.Should().BeFalse();
        response.Sessions.Should().BeEmpty();

#pragma warning disable CS0618
        response.Session.Should().BeNull();
#pragma warning restore CS0618
    }

    [Fact]
    public async Task HandleAsync_NoActivePlan_ReturnsHasSessionFalse()
    {
        var mongo = CreateMongoWithPlan(null);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.HasSession.Should().BeFalse();
        ep.Response.Sessions.Should().BeEmpty();

#pragma warning disable CS0618
        ep.Response.Session.Should().BeNull();
#pragma warning restore CS0618
    }

    [Fact]
    public async Task HandleAsync_NoPublishedWeeks_ReturnsHasSessionFalse()
    {
        var startOfWeek = StartOfCurrentWeek();

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Unpublished Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = startOfWeek,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Draft,
                    Sessions = []
                }
            ],
            Version = 1,
            DateCreated = startOfWeek
        };

        var mongo = CreateMongoWithPlan(plan);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
        ep.Response.HasSession.Should().BeFalse();
        ep.Response.Sessions.Should().BeEmpty();
    }

    // -------------------------------------------------------------------------
    // Auth guard
    // -------------------------------------------------------------------------

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var mongo = CreateMongoWithPlan(null);
        var db = CreateMockDb();

        var ep = Factory.Create<GetTodaySessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity()),
            mongo, db, CreateStubLockService());

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_NoClientProfile_Returns404()
    {
        var mongo = CreateMongoWithPlan(null);
        // Build a db with no client profiles
        var db = new MockDbBuilder().Build();

        var ep = Factory.Create<GetTodaySessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, CreateStubLockService());

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    // -------------------------------------------------------------------------
    // WorkoutLog (live-session) → Today-card sync — regression for clientId bug
    // -------------------------------------------------------------------------

    /// <summary>
    /// Regression: WorkoutLog.ClientId is the auth user's ApplicationUser.Id (Guid),
    /// NOT clientProfile.PublicId. Before the fix the filter used PublicId, which never
    /// matched, so the live-training progress silently returned nothing on the Today card.
    /// This test seeds a fully-completed WorkoutLog with ClientId = userId (not PublicId)
    /// and asserts the exercise appears in CompletedExerciseIdsBySession.
    /// </summary>
    [Fact]
    public async Task HandleAsync_WorkoutLogWithUserIdAsClientId_AppearsInCompletedExerciseIdsBySession()
    {
        var todayDow = TodayDow();
        var startOfWeek = StartOfCurrentWeek();
        var sessionId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();

        // _clientId is both the UserId in the JWT claim AND the ClientProfile.UserId.
        // The ClientProfile has PublicId = _clientId (see CreateMockDb), which happens
        // to share the same value for simplicity, but the point of this test is that
        // the WorkoutLog is written with ClientId = userId, not ClientProfile.PublicId.
        // We make them deliberately distinct to prove the filter uses the right one.
        var distinctPublicId = Guid.NewGuid(); // PublicId != UserId
        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = distinctPublicId })
            .Build();

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = distinctPublicId, // plan is linked via PublicId
            TrainerId = Guid.NewGuid(),
            Name = "Live Training Plan",
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
                            Name = "Pull Day",
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
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = exerciseId,
                                            ExerciseName = "Pull-up",
                                            Order = 1,
                                            Sets =
                                            [
                                                new ExerciseSet { SetNumber = 1 }
                                            ]
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

        // WorkoutLog.ClientId is the JWT user id (_clientId), NOT distinctPublicId.
        // Before the fix the filter used distinctPublicId and this log was never found.
        var log = new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId, // <-- user id, not PublicId
            SessionId = sessionId,
            PlanId = plan.ExternalId,
            StartedAt = DateTime.UtcNow,
            Sections =
            [
                new WorkoutSection
                {
                    SectionId = Guid.NewGuid(),
                    Order = 0,
                    Name = "Hlavní",
                    Exercises =
                    [
                        new WorkoutExercise
                        {
                            ExerciseExternalId = exerciseId,
                            ExerciseName = "Pull-up",
                            Sets =
                            [
                                new WorkoutSet { SetNumber = 1, CompletedAt = DateTime.UtcNow }
                            ]
                        }
                    ]
                }
            ]
        };

        var ep = Factory.Create<GetTodaySessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            CreateMongoWithPlan(plan, workoutLogs: [log]),
            db, CreateStubLockService());

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        var response = ep.Response;
        response.HasSession.Should().BeTrue();
        response.CompletedExerciseIdsBySession.Should()
            .ContainKey(sessionId, "the live-log session must be merged into the completion dict");
        response.CompletedExerciseIdsBySession[sessionId].Should()
            .Contain(exerciseId, "the fully-completed exercise must appear in the Today card");
    }

    // -------------------------------------------------------------------------
    // Partial-completion regression — only fully-done exercises should appear
    // -------------------------------------------------------------------------

    /// <summary>
    /// Regression: completing ONE set of THREE for exercise X must NOT mark X as
    /// completed on the Today card. Before the fix the stale-log union path would
    /// surface any IsCompleted=true log from earlier in the day and union all its
    /// exercises on top of the fresh partial log, making the whole session appear
    /// done. This test verifies that a single WorkoutLog with one partial exercise
    /// (set 1 done, sets 2+3 null) does NOT add the exercise to
    /// CompletedExerciseIdsBySession.
    /// </summary>
    [Fact]
    public async Task HandleAsync_PartialSetCompletion_ExerciseNotInCompletedExerciseIds()
    {
        var todayDow = TodayDow();
        var startOfWeek = StartOfCurrentWeek();
        var sessionId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();

        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Partial Completion Plan",
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
                            Name = "Push Day",
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
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = exerciseId,
                                            ExerciseName = "Bench Press",
                                            Order = 1,
                                            Sets =
                                            [
                                                new ExerciseSet { SetNumber = 1 },
                                                new ExerciseSet { SetNumber = 2 },
                                                new ExerciseSet { SetNumber = 3 }
                                            ]
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

        // Only set #1 is completed — sets #2 and #3 have CompletedAt = null.
        // This mirrors what the mobile client sends after the user marks one set done.
        var partialLog = new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            SessionId = sessionId,
            PlanId = plan.ExternalId,
            StartedAt = DateTime.UtcNow,
            IsCompleted = false,
            Sections =
            [
                new WorkoutSection
                {
                    SectionId = Guid.NewGuid(),
                    Order = 0,
                    Name = "Hlavní",
                    Exercises =
                    [
                        new WorkoutExercise
                        {
                            ExerciseExternalId = exerciseId,
                            ExerciseName = "Bench Press",
                            Sets =
                            [
                                new WorkoutSet { SetNumber = 1, CompletedAt = DateTime.UtcNow },
                                new WorkoutSet { SetNumber = 2, CompletedAt = null },
                                new WorkoutSet { SetNumber = 3, CompletedAt = null }
                            ]
                        }
                    ]
                }
            ]
        };

        var ep = Factory.Create<GetTodaySessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            CreateMongoWithPlan(plan, workoutLogs: [partialLog]),
            db, CreateStubLockService());

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        var response = ep.Response;
        response.HasSession.Should().BeTrue();

        // The partially-done exercise must NOT appear as completed.
        var completedForSession = response.CompletedExerciseIdsBySession.GetValueOrDefault(sessionId);
        completedForSession.Should().NotContain(exerciseId,
            "only one of three sets is done — the exercise must not be marked complete");
    }

    // -------------------------------------------------------------------------
    // CompletedSetsBySessionExercise — per-set completion map
    // -------------------------------------------------------------------------
    //
    // #841: the "stale/multiple WorkoutLogs for the same session on the same day, pick
    // the latest" tests formerly here (HandleAsync_StaleCompletedLogPlusPartialLog_*,
    // HandleAsync_MultipleLogsWithIdenticalStartedAt_PicksDeterministically) were removed.
    // That scenario is no longer reachable: the unified SessionExecutions collection
    // enforces a partial-unique index on (clientId, sessionId, date), so at most ONE
    // execution document can exist per planned session per calendar day — the app-level
    // "latest wins" tie-break these tests guarded is now a DB-level invariant instead.

    /// <summary>
    /// Seeding exercise X with 3 planned sets and a WorkoutLog where only
    /// set #1 has CompletedAt set must populate CompletedSetsBySessionExercise
    /// with [1] for that exercise, and must NOT add X to
    /// CompletedExerciseIdsBySession (the exercise is still in progress).
    /// </summary>
    [Fact]
    public async Task HandleAsync_PartialSetCompletion_PopulatesCompletedSetsBySessionExercise()
    {
        var todayDow = TodayDow();
        var startOfWeek = StartOfCurrentWeek();
        var sessionId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();

        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Per-Set Completion Plan",
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
                            Name = "Push Day",
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
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = exerciseId,
                                            ExerciseName = "Bench Press",
                                            Order = 1,
                                            Sets =
                                            [
                                                new ExerciseSet { SetNumber = 1 },
                                                new ExerciseSet { SetNumber = 2 },
                                                new ExerciseSet { SetNumber = 3 }
                                            ]
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

        // Only set #1 is completed — sets #2 and #3 have CompletedAt = null.
        var partialLog = new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            SessionId = sessionId,
            PlanId = plan.ExternalId,
            StartedAt = DateTime.UtcNow,
            IsCompleted = false,
            Sections =
            [
                new WorkoutSection
                {
                    SectionId = Guid.NewGuid(),
                    Order = 0,
                    Name = "Hlavní",
                    Exercises =
                    [
                        new WorkoutExercise
                        {
                            ExerciseExternalId = exerciseId,
                            ExerciseName = "Bench Press",
                            Sets =
                            [
                                new WorkoutSet { SetNumber = 1, CompletedAt = DateTime.UtcNow },
                                new WorkoutSet { SetNumber = 2, CompletedAt = null },
                                new WorkoutSet { SetNumber = 3, CompletedAt = null }
                            ]
                        }
                    ]
                }
            ]
        };

        var ep = Factory.Create<GetTodaySessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            CreateMongoWithPlan(plan, workoutLogs: [partialLog]),
            db, CreateStubLockService());

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        var response = ep.Response;
        response.HasSession.Should().BeTrue();

        // Set #1 must appear in the per-set map.
        response.CompletedSetsBySessionExercise.Should().ContainKey(sessionId);
        response.CompletedSetsBySessionExercise[sessionId].Should().ContainKey(exerciseId);
        response.CompletedSetsBySessionExercise[sessionId][exerciseId].Should().BeEquivalentTo(new[] { 1 });

        // The exercise is only partially done — it must NOT appear as fully completed.
        var completedIds = response.CompletedExerciseIdsBySession.GetValueOrDefault(sessionId);
        completedIds.Should().NotContain(exerciseId,
            "only set #1 of 3 is done — the exercise must not be in CompletedExerciseIdsBySession");
    }

    // -------------------------------------------------------------------------
    // Set-completion derived from exercise-level completion (checkbox path)
    // -------------------------------------------------------------------------

    /// <summary>
    /// When an exercise is marked complete via TrainingCompletion (Today-card checkbox)
    /// and no WorkoutLog exists, the endpoint must derive all planned set numbers as
    /// complete so the per-set ✓ column reflects the checkbox state.
    /// </summary>
    [Fact]
    public async Task HandleAsync_ExerciseMarkedCompleteViaTrainingCompletion_PopulatesAllPlannedSetNumbers()
    {
        var todayDow = TodayDow();
        var startOfWeek = StartOfCurrentWeek();
        var sessionId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();

        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Checkbox Completion Plan",
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
                            Name = "Push Day",
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
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = exerciseId,
                                            ExerciseName = "Bench Press",
                                            Order = 1,
                                            Sets =
                                            [
                                                new ExerciseSet { SetNumber = 1 },
                                                new ExerciseSet { SetNumber = 2 },
                                                new ExerciseSet { SetNumber = 3 }
                                            ]
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

        // Exercise is marked complete via the Today card — no WorkoutLog exists.
        var completionDoc = new TrainingCompletion
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            Date = DateTime.UtcNow.Date,
            SessionId = sessionId,
            CompletedExerciseIds = [exerciseId],
            Version = 1,
            DateCreated = DateTime.UtcNow
        };

        var ep = Factory.Create<GetTodaySessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            CreateMongoWithPlan(plan, completions: [completionDoc]),
            db, CreateStubLockService());

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        var response = ep.Response;
        response.HasSession.Should().BeTrue();

        // The exercise must appear in CompletedExerciseIdsBySession.
        response.CompletedExerciseIdsBySession.Should().ContainKey(sessionId);
        response.CompletedExerciseIdsBySession[sessionId].Should().Contain(exerciseId);

        // All three planned set numbers must be derived as complete.
        response.CompletedSetsBySessionExercise.Should().ContainKey(sessionId);
        response.CompletedSetsBySessionExercise[sessionId].Should().ContainKey(exerciseId);
        response.CompletedSetsBySessionExercise[sessionId][exerciseId].Should()
            .BeEquivalentTo(new[] { 1, 2, 3 },
                "all planned sets must be marked complete when the exercise checkbox is ticked");
    }

    /// <summary>
    /// When a partial WorkoutLog (set #1 stamped, sets #2+3 null) exists AND the user
    /// has also ticked the Today-card exercise checkbox (TrainingCompletion), the
    /// resulting set map must be the union of the WorkoutLog's stamped sets and all
    /// planned set numbers — i.e. [1, 2, 3].
    /// </summary>
    [Fact]
    public async Task HandleAsync_PartialWorkoutLogPlusExerciseCheckbox_UnionsSetNumbers()
    {
        var todayDow = TodayDow();
        var startOfWeek = StartOfCurrentWeek();
        var sessionId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();

        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Mixed Completion Plan",
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
                            Name = "Pull Day",
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
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = exerciseId,
                                            ExerciseName = "Pull-up",
                                            Order = 1,
                                            Sets =
                                            [
                                                new ExerciseSet { SetNumber = 1 },
                                                new ExerciseSet { SetNumber = 2 },
                                                new ExerciseSet { SetNumber = 3 }
                                            ]
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

        // WorkoutLog: only set #1 stamped — sets #2 and #3 are null.
        var partialLog = new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            SessionId = sessionId,
            PlanId = plan.ExternalId,
            StartedAt = DateTime.UtcNow,
            IsCompleted = false,
            Sections =
            [
                new WorkoutSection
                {
                    SectionId = Guid.NewGuid(),
                    Order = 0,
                    Name = "Hlavní",
                    Exercises =
                    [
                        new WorkoutExercise
                        {
                            ExerciseExternalId = exerciseId,
                            ExerciseName = "Pull-up",
                            Sets =
                            [
                                new WorkoutSet { SetNumber = 1, CompletedAt = DateTime.UtcNow },
                                new WorkoutSet { SetNumber = 2, CompletedAt = null },
                                new WorkoutSet { SetNumber = 3, CompletedAt = null }
                            ]
                        }
                    ]
                }
            ]
        };

        // TrainingCompletion: user ticked the checkbox on the Today card.
        var completionDoc = new TrainingCompletion
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            Date = DateTime.UtcNow.Date,
            SessionId = sessionId,
            CompletedExerciseIds = [exerciseId],
            Version = 1,
            DateCreated = DateTime.UtcNow
        };

        var ep = Factory.Create<GetTodaySessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            CreateMongoWithPlan(plan, completions: [completionDoc], workoutLogs: [partialLog]),
            db, CreateStubLockService());

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        var response = ep.Response;
        response.HasSession.Should().BeTrue();

        // The exercise must appear in CompletedExerciseIdsBySession.
        response.CompletedExerciseIdsBySession.Should().ContainKey(sessionId);
        response.CompletedExerciseIdsBySession[sessionId].Should().Contain(exerciseId);

        // Union of WorkoutLog's {1} and planned {1,2,3} = {1,2,3}.
        response.CompletedSetsBySessionExercise.Should().ContainKey(sessionId);
        response.CompletedSetsBySessionExercise[sessionId].Should().ContainKey(exerciseId);
        response.CompletedSetsBySessionExercise[sessionId][exerciseId].Should()
            .BeEquivalentTo(new[] { 1, 2, 3 },
                "union of the partial log's set #1 and all planned sets must give [1,2,3]");
    }

    // -------------------------------------------------------------------------
    // ExerciseMuscleGroups enrichment
    // -------------------------------------------------------------------------
    //
    // #841: HandleAsync_MultipleLogsWithIdenticalStartedAt_PicksDeterministically (the
    // StartedAt-tie-break-by-DateCreated regression test) was removed for the same reason
    // as the stale/multiple-log tests above — two WorkoutLogs/executions for the same
    // (clientId, sessionId, date) can no longer coexist under the unified model's
    // partial-unique index.

    [Fact]
    public async Task HandleAsync_SessionsWithMatchingExerciseDocs_PopulatesExerciseMuscleGroups()
    {
        var todayDow = TodayDow();
        var startOfWeek = StartOfCurrentWeek();
        var exerciseId1 = Guid.NewGuid();
        var exerciseId2 = Guid.NewGuid();

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Enrichment Plan",
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
                            SessionId = Guid.NewGuid(),
                            DayOfWeek = todayDow,
                            Name = "Legs",
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
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = exerciseId1,
                                            ExerciseName = "Squat",
                                            Order = 1,
                                            Sets = []
                                        },
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = exerciseId2,
                                            ExerciseName = "Lunge",
                                            Order = 2,
                                            Sets = []
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

        var exercises = new List<Exercise>
        {
            new()
            {
                ExternalId = exerciseId1,
                Name = "Squat",
                MuscleGroups = [MuscleGroup.Quadriceps, MuscleGroup.Glutes]
            },
            new()
            {
                ExternalId = exerciseId2,
                Name = "Lunge",
                MuscleGroups = [MuscleGroup.Quadriceps, MuscleGroup.Hamstrings]
            }
        };

        var mongo = CreateMongoWithPlan(plan, exercises);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        var response = ep.Response;
        response.ExerciseMuscleGroups.Should().ContainKey(exerciseId1);
        response.ExerciseMuscleGroups[exerciseId1].Should().BeEquivalentTo(
            new[] { MuscleGroup.Quadriceps, MuscleGroup.Glutes });

        response.ExerciseMuscleGroups.Should().ContainKey(exerciseId2);
        response.ExerciseMuscleGroups[exerciseId2].Should().BeEquivalentTo(
            new[] { MuscleGroup.Quadriceps, MuscleGroup.Hamstrings });
    }

    // -------------------------------------------------------------------------
    // TrainingCompletion enrichment
    // -------------------------------------------------------------------------

    [Fact]
    public async Task HandleAsync_WithExistingTrainingCompletion_ReturnsCompletedIdsAndVersion()
    {
        var todayDow = TodayDow();
        var startOfWeek = StartOfCurrentWeek();
        var sessionId = Guid.NewGuid();
        var exercise1Id = Guid.NewGuid();
        var exercise2Id = Guid.NewGuid();

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Completion Plan",
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
                            Name = "Push Day",
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
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = exercise1Id,
                                            ExerciseName = "Bench Press",
                                            Order = 1,
                                            Sets = []
                                        },
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = exercise2Id,
                                            ExerciseName = "Overhead Press",
                                            Order = 2,
                                            Sets = []
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

        var completionDoc = new TrainingCompletion
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            Date = DateTime.UtcNow.Date,
            SessionId = sessionId,
            CompletedExerciseIds = [exercise1Id],
            Version = 3,
            DateCreated = DateTime.UtcNow
        };

        var mongo = CreateMongoWithPlan(plan, completions: [completionDoc]);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        var response = ep.Response;
        response.HasSession.Should().BeTrue();
        response.CompletedExerciseIdsBySession.Should().ContainKey(sessionId);
        response.CompletedExerciseIdsBySession[sessionId].Should().BeEquivalentTo(new[] { exercise1Id });
        response.VersionBySession.Should().ContainKey(sessionId);
        response.VersionBySession[sessionId].Should().Be(3);
    }

    [Fact]
    public async Task HandleAsync_WithNoCompletionDocuments_ReturnsEmptyDicts()
    {
        var todayDow = TodayDow();
        var startOfWeek = StartOfCurrentWeek();
        var sessionId = Guid.NewGuid();

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "No Completion Plan",
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
                            Name = "Legs",
                            Order = 1,
                            Sections = []
                        }
                    ]
                }
            ],
            Version = 1,
            DateCreated = startOfWeek
        };

        // No completion documents seeded
        var mongo = CreateMongoWithPlan(plan);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        var response = ep.Response;
        response.HasSession.Should().BeTrue();
        response.CompletedExerciseIdsBySession.Should().BeEmpty();
        response.VersionBySession.Should().BeEmpty();
    }

    [Fact]
    public async Task HandleAsync_ExerciseNotInDatabase_AbsentFromExerciseMuscleGroups_NoException()
    {
        var todayDow = TodayDow();
        var startOfWeek = StartOfCurrentWeek();
        var knownExerciseId = Guid.NewGuid();
        var unknownExerciseId = Guid.NewGuid();

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Missing Exercise Plan",
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
                            SessionId = Guid.NewGuid(),
                            DayOfWeek = todayDow,
                            Name = "Push",
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
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = knownExerciseId,
                                            ExerciseName = "Bench Press",
                                            Order = 1,
                                            Sets = []
                                        },
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = unknownExerciseId,
                                            ExerciseName = "Deleted Exercise",
                                            Order = 2,
                                            Sets = []
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

        // Only return a doc for the known exercise; the unknown one is absent.
        var exercises = new List<Exercise>
        {
            new()
            {
                ExternalId = knownExerciseId,
                Name = "Bench Press",
                MuscleGroups = [MuscleGroup.Chest, MuscleGroup.Triceps]
            }
        };

        var mongo = CreateMongoWithPlan(plan, exercises);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        var response = ep.Response;
        response.ExerciseMuscleGroups.Should().ContainKey(knownExerciseId);
        response.ExerciseMuscleGroups[knownExerciseId].Should().BeEquivalentTo(
            new[] { MuscleGroup.Chest, MuscleGroup.Triceps });

        // The unknown exercise must be absent — not an exception, just missing.
        response.ExerciseMuscleGroups.Should().NotContainKey(unknownExerciseId);
    }

    // -------------------------------------------------------------------------
    // #838 — two-phase projected read: byte-equivalence across edge cases.
    // These assert the phase-1 (light projection) + phase-2 (per-week hydration)
    // split still produces the exact same response shape as the old single
    // full-fetch implementation for the tricky window/week-resolution cases.
    // -------------------------------------------------------------------------

    /// <summary>
    /// A plan whose StartDate is far enough in the future that its window
    /// <c>[StartDate, StartDate + weekCount*7)</c> doesn't contain today must never
    /// reach phase-2 hydration — <see cref="PlanWindowResolver.ResolveCurrentPlan{T}"/>
    /// filters it out at phase 1 already (it isn't "the current plan" at all, same as
    /// pre-#838 behavior), so the response must be the bare HasSession=false state with
    /// no plan metadata and no leaked session content from the not-yet-started week.
    /// </summary>
    [Fact]
    public async Task HandleAsync_FutureStartDate_ReturnsNoPlanState()
    {
        var todayDow = TodayDow();
        var futureStart = DateTime.UtcNow.Date.AddDays(30);

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Not Started Yet Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = futureStart,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = futureStart,
                    Sessions =
                    [
                        new TrainingSession
                        {
                            SessionId = Guid.NewGuid(),
                            DayOfWeek = todayDow,
                            Name = "Future Session",
                            Order = 1,
                            Sections = []
                        }
                    ]
                }
            ],
            Version = 1,
            DateCreated = DateTime.UtcNow
        };

        var mongo = CreateMongoWithPlan(plan);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        var response = ep.Response;
        response.HasSession.Should().BeFalse("the plan's window doesn't contain today yet");
        response.PlanId.Should().BeNull("a plan whose window excludes today is not resolved as 'current' — same as pre-#838 behavior");
        response.Sessions.Should().BeEmpty();
    }

    /// <summary>
    /// Regression for #838: when the resolved week number is past the last PUBLISHED
    /// week (trainer hasn't queued anything for today yet, even though the plan's
    /// window still contains today), the endpoint must return the metadata-only
    /// response without ever calling phase-2 hydration for a week that doesn't exist
    /// as "current".
    /// </summary>
    [Fact]
    public async Task HandleAsync_PastLastPublishedWeek_ReturnsMetadataOnlyNoSession()
    {
        var todayDow = TodayDow();
        // Plan started 3 weeks ago; only week 1 is published. Today resolves to
        // week 4 (daysSinceStart/7+1), which is past the last published week (1).
        var startDate = StartOfCurrentWeek().AddDays(-21);

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Stale Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = startDate,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = startDate,
                    Sessions =
                    [
                        new TrainingSession
                        {
                            SessionId = Guid.NewGuid(),
                            DayOfWeek = todayDow,
                            Name = "Week 1 Session",
                            Order = 1,
                            Sections = []
                        }
                    ]
                },
                new TrainingWeek { WeekNumber = 2, Status = WeekStatus.Draft, Sessions = [] },
                new TrainingWeek { WeekNumber = 3, Status = WeekStatus.Draft, Sessions = [] },
                new TrainingWeek { WeekNumber = 4, Status = WeekStatus.Draft, Sessions = [] }
            ],
            Version = 1,
            DateCreated = startDate
        };

        var mongo = CreateMongoWithPlan(plan);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        var response = ep.Response;
        response.HasSession.Should().BeFalse("the trainer hasn't published anything for the current week yet");
        response.PlanId.Should().Be(plan.ExternalId);
        response.TotalWeeks.Should().Be(4);
        response.Sessions.Should().BeEmpty();
    }

    /// <summary>
    /// Regression for #838: gap-skip. Trainer published weeks 1, 2 and 4 but left
    /// week 3 as a Draft. Today's calculated week is 3 (unpublished) — the endpoint
    /// must fall back to the latest published week not after the calculated one
    /// (week 2), and phase-2 hydration must fetch WEEK 2's session content — not
    /// week 3's (doesn't exist) and not week 4's (ahead of the trainer's cursor).
    /// </summary>
    [Fact]
    public async Task HandleAsync_GapSkipWeek_HydratesFallbackWeekNotCalculatedOrAheadWeek()
    {
        var todayDow = TodayDow();
        // Plan started 2 full weeks ago, so today falls in week 3 (daysSinceStart/7+1 = 3).
        var startDate = StartOfCurrentWeek().AddDays(-14);
        var week2SessionId = Guid.NewGuid();
        var week4SessionId = Guid.NewGuid();

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Gap Skip Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = startDate,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = startDate,
                    Sessions = [new TrainingSession { SessionId = Guid.NewGuid(), DayOfWeek = todayDow, Name = "Week 1 Session", Order = 1, Sections = [] }]
                },
                new TrainingWeek
                {
                    WeekNumber = 2,
                    Status = WeekStatus.Published,
                    DatePublished = startDate,
                    Sessions = [new TrainingSession { SessionId = week2SessionId, DayOfWeek = todayDow, Name = "Week 2 Session (fallback target)", Order = 1, Sections = [] }]
                },
                new TrainingWeek
                {
                    // Week 3 is the calculated week (unpublished) — must be skipped entirely.
                    WeekNumber = 3,
                    Status = WeekStatus.Draft,
                    Sessions = [new TrainingSession { SessionId = Guid.NewGuid(), DayOfWeek = todayDow, Name = "Week 3 Session (must never appear)", Order = 1, Sections = [] }]
                },
                new TrainingWeek
                {
                    // Week 4 is published but AHEAD of the calculated week — must never appear either.
                    WeekNumber = 4,
                    Status = WeekStatus.Published,
                    DatePublished = startDate,
                    Sessions = [new TrainingSession { SessionId = week4SessionId, DayOfWeek = todayDow, Name = "Week 4 Session (must never appear)", Order = 1, Sections = [] }]
                }
            ],
            Version = 1,
            DateCreated = startDate
        };

        var mongo = CreateMongoWithPlan(plan);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        var response = ep.Response;
        response.HasSession.Should().BeTrue();
        response.CurrentWeek.Should().Be(2, "the resolver must fall back to the latest published week not after the calculated (unpublished) week 3");
#pragma warning disable CS0618
        response.Session!.SessionId.Should().Be(week2SessionId, "phase-2 hydration must fetch week 2's content, not week 3's or week 4's");
        response.Session!.Name.Should().Be("Week 2 Session (fallback target)");
#pragma warning restore CS0618
    }

    /// <summary>
    /// Regression for #838: legacy plans with no StartDate cycle through published
    /// weeks based on the first published week's DatePublished. This asserts phase-2
    /// hydration fetches the CORRECT cycled week's session content, not week 1's by
    /// default.
    /// </summary>
    [Fact]
    public async Task HandleAsync_LegacyNoStartDate_CyclesToCorrectWeek_HydratesThatWeeksSession()
    {
        var todayDow = TodayDow();
        var week2SessionId = Guid.NewGuid();
        // Two published weeks, published 8 days ago: (8 / 7) % 2 = 1 → cycles to week index 1 (week 2).
        var firstPublishDate = DateTime.UtcNow.Date.AddDays(-8);

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Legacy Cycling Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = null, // legacy plan — no StartDate
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = firstPublishDate,
                    Sessions = [new TrainingSession { SessionId = Guid.NewGuid(), DayOfWeek = todayDow, Name = "Week 1 Session (must never appear)", Order = 1, Sections = [] }]
                },
                new TrainingWeek
                {
                    WeekNumber = 2,
                    Status = WeekStatus.Published,
                    DatePublished = firstPublishDate,
                    Sessions = [new TrainingSession { SessionId = week2SessionId, DayOfWeek = todayDow, Name = "Week 2 Session (cycle target)", Order = 1, Sections = [] }]
                }
            ],
            Version = 1,
            DateCreated = firstPublishDate
        };

        var mongo = CreateMongoWithPlan(plan);
        var db = CreateMockDb();
        var ep = CreateEndpoint(mongo, db);

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        var response = ep.Response;
        response.HasSession.Should().BeTrue();
        response.CurrentWeek.Should().Be(2, "8 days since first publish cycles to week index 1 (week 2) for a 2-week legacy plan");
#pragma warning disable CS0618
        response.Session!.SessionId.Should().Be(week2SessionId);
        response.Session!.Name.Should().Be("Week 2 Session (cycle target)");
#pragma warning restore CS0618
    }
}
