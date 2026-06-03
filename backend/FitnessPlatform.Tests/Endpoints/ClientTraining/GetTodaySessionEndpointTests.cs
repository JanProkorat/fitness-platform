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
        var mongo = Substitute.For<IMongoContext>();
        var plans = plan is not null ? new List<TrainingPlan> { plan } : new List<TrainingPlan>();

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

        return mongo;
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
                                new TrainingSection
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
                                new TrainingSection
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

    /// <summary>
    /// Regression (hypothesis 4): when the user completes an entire session earlier
    /// in the day (IsCompleted=true, all sets done) and then starts a fresh partial
    /// log for the same session, ONLY the newest log should determine completion state.
    /// The older completed log's fully-done exercises must NOT leak into
    /// CompletedExerciseIdsBySession when the current log is partial.
    /// </summary>
    [Fact]
    public async Task HandleAsync_StaleCompletedLogPlusPartialLog_OnlyLatestLogDeterminesCompletion()
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
            Name = "Stale Log Plan",
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
                                new TrainingSection
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
                                                new ExerciseSet { SetNumber = 2 }
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

        var olderStartedAt = DateTime.UtcNow.AddHours(-3);

        // Older log — IsCompleted=true, all sets done. Simulates a full session
        // completed earlier today (e.g. during a test run or a restarted session).
        var completedLog = new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            SessionId = sessionId,
            PlanId = plan.ExternalId,
            StartedAt = olderStartedAt,
            IsCompleted = true,
            CompletedAt = olderStartedAt.AddHours(1),
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
                                new WorkoutSet { SetNumber = 1, CompletedAt = olderStartedAt.AddMinutes(10) },
                                new WorkoutSet { SetNumber = 2, CompletedAt = olderStartedAt.AddMinutes(20) }
                            ]
                        }
                    ]
                }
            ]
        };

        // Newer log — fresh start, only one set done (partial).
        var newerPartialLog = new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            SessionId = sessionId,
            PlanId = plan.ExternalId,
            StartedAt = DateTime.UtcNow.AddMinutes(-5),
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
                                new WorkoutSet { SetNumber = 1, CompletedAt = DateTime.UtcNow.AddMinutes(-2) },
                                new WorkoutSet { SetNumber = 2, CompletedAt = null }
                            ]
                        }
                    ]
                }
            ]
        };

        // Both logs are seeded — the older completed one and the newer partial one.
        var ep = Factory.Create<GetTodaySessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            CreateMongoWithPlan(plan, workoutLogs: [completedLog, newerPartialLog]),
            db, CreateStubLockService());

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        var response = ep.Response;
        response.HasSession.Should().BeTrue();

        // The older completed log's exercises must NOT propagate. The newest log
        // is partial, so no exercise should be marked complete.
        var completedForSession = response.CompletedExerciseIdsBySession.GetValueOrDefault(sessionId);
        completedForSession.Should().NotContain(exerciseId,
            "the newest log for this session is partial — the stale completed log must not override it");
    }

    // -------------------------------------------------------------------------
    // CompletedSetsBySessionExercise — per-set completion map
    // -------------------------------------------------------------------------

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
                                new TrainingSection
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

    /// <summary>
    /// Regression: when an older fully-completed log exists alongside a newer partial log
    /// for the same session, ONLY the newest log (by StartedAt) must feed
    /// CompletedSetsBySessionExercise. The older log's sets must not leak into the map.
    /// </summary>
    [Fact]
    public async Task HandleAsync_StaleCompletedLogPlusPartialLog_OnlyLatestLogSetsInMap()
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
            Name = "Stale Sets Plan",
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
                                new TrainingSection
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

        var olderStartedAt = DateTime.UtcNow.AddHours(-3);

        // Older log — all 3 sets done (fully completed session restart).
        var completedLog = new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            SessionId = sessionId,
            PlanId = plan.ExternalId,
            StartedAt = olderStartedAt,
            IsCompleted = true,
            CompletedAt = olderStartedAt.AddHours(1),
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
                                new WorkoutSet { SetNumber = 1, CompletedAt = olderStartedAt.AddMinutes(10) },
                                new WorkoutSet { SetNumber = 2, CompletedAt = olderStartedAt.AddMinutes(20) },
                                new WorkoutSet { SetNumber = 3, CompletedAt = olderStartedAt.AddMinutes(30) }
                            ]
                        }
                    ]
                }
            ]
        };

        // Newer log — fresh restart, only set #1 done.
        var newerPartialLog = new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            SessionId = sessionId,
            PlanId = plan.ExternalId,
            StartedAt = DateTime.UtcNow.AddMinutes(-5),
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
                                new WorkoutSet { SetNumber = 1, CompletedAt = DateTime.UtcNow.AddMinutes(-2) },
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
            CreateMongoWithPlan(plan, workoutLogs: [completedLog, newerPartialLog]),
            db, CreateStubLockService());

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        var response = ep.Response;
        response.HasSession.Should().BeTrue();

        // Only set #1 from the LATEST log must appear — NOT sets #2 and #3 from the old log.
        response.CompletedSetsBySessionExercise.Should().ContainKey(sessionId);
        response.CompletedSetsBySessionExercise[sessionId].Should().ContainKey(exerciseId);
        response.CompletedSetsBySessionExercise[sessionId][exerciseId].Should()
            .BeEquivalentTo(new[] { 1 },
                "the older fully-completed log must not bleed sets #2 and #3 into the map");
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
                                new TrainingSection
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
                                new TrainingSection
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
    // latestLogPerSession tie-breaker — determinism when StartedAt is identical
    // -------------------------------------------------------------------------

    /// <summary>
    /// Regression: when two WorkoutLogs for the same session share an identical StartedAt
    /// (e.g. start-workout retried on a flaky network), the secondary sort by DateCreated
    /// descending must break the tie deterministically.
    /// The log with the later DateCreated (newerLog) should win, so only its exercises
    /// appear in CompletedExerciseIdsBySession / CompletedSetsBySessionExercise.
    /// </summary>
    [Fact]
    public async Task HandleAsync_MultipleLogsWithIdenticalStartedAt_PicksDeterministically()
    {
        var todayDow = TodayDow();
        var startOfWeek = StartOfCurrentWeek();
        var sessionId = Guid.NewGuid();
        var exerciseA = Guid.NewGuid(); // only in olderLog (all sets done)
        var exerciseB = Guid.NewGuid(); // only in newerLog (all sets done)

        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

        var sharedStartedAt = DateTime.UtcNow.AddMinutes(-10); // identical for both logs

        var plan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Tie-Breaker Plan",
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
                                new TrainingSection
                                {
                                    SectionId = Guid.NewGuid(),
                                    Order = 0,
                                    Name = "Hlavní",
                                    Exercises =
                                    [
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = exerciseA,
                                            ExerciseName = "Exercise A",
                                            Order = 1,
                                            Sets = [new ExerciseSet { SetNumber = 1 }]
                                        },
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = exerciseB,
                                            ExerciseName = "Exercise B",
                                            Order = 2,
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

        // Older log (lower DateCreated): only exerciseA fully done.
        var olderLog = new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            SessionId = sessionId,
            PlanId = plan.ExternalId,
            StartedAt = sharedStartedAt,
            IsCompleted = false,
            DateCreated = sharedStartedAt,                        // earlier insert
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
                            ExerciseExternalId = exerciseA,
                            ExerciseName = "Exercise A",
                            Sets = [new WorkoutSet { SetNumber = 1, CompletedAt = DateTime.UtcNow }]
                        }
                    ]
                }
            ]
        };

        // Newer log (higher DateCreated): only exerciseB fully done.
        var newerLog = new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            SessionId = sessionId,
            PlanId = plan.ExternalId,
            StartedAt = sharedStartedAt,                         // identical StartedAt
            IsCompleted = false,
            DateCreated = sharedStartedAt.AddSeconds(2),         // later insert — wins tie-break
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
                            ExerciseExternalId = exerciseB,
                            ExerciseName = "Exercise B",
                            Sets = [new WorkoutSet { SetNumber = 1, CompletedAt = DateTime.UtcNow }]
                        }
                    ]
                }
            ]
        };

        var ep = Factory.Create<GetTodaySessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            CreateMongoWithPlan(plan, workoutLogs: [olderLog, newerLog]),
            db, CreateStubLockService());

        await ep.HandleAsync(TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        var response = ep.Response;
        response.HasSession.Should().BeTrue();

        // The newer log (exerciseB complete) must win — exerciseA from the older log must not appear.
        var completed = response.CompletedExerciseIdsBySession.GetValueOrDefault(sessionId) ?? [];
        completed.Should().Contain(exerciseB, "the newer log (higher DateCreated) must win the tie-break");
        completed.Should().NotContain(exerciseA, "the older log must be discarded by the tie-break");
    }

    // -------------------------------------------------------------------------
    // ExerciseMuscleGroups enrichment
    // -------------------------------------------------------------------------

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
                                new TrainingSection
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
                                new TrainingSection
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
                                new TrainingSection
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
}
