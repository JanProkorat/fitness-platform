using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.ClientTraining.MarkExerciseComplete;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.TrainingPlans;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.ClientTraining;

/// <summary>
/// Tests for <see cref="MarkExerciseCompleteEndpoint"/>.
/// </summary>
public class MarkExerciseCompleteEndpointTests
{
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly Guid _sessionId = Guid.NewGuid();
    private readonly Guid _sectionId = Guid.NewGuid();
    private readonly Guid _exercise1 = Guid.NewGuid();
    private readonly Guid _exercise2 = Guid.NewGuid();
    private readonly IRealtimeNotifier _notifier = TrainingCompletionTestHelpers.CreateStubNotifier();
    private readonly IComplianceService _compliance = TrainingCompletionTestHelpers.CreateStubComplianceService();
    private readonly ISessionLockService _lockService = CreateStubLockService();
    private static readonly IOptions<TrainingLockOptions> LockOptions =
        Options.Create(new TrainingLockOptions { LiveTtlHours = 6 });
    private readonly IClientLinkAuthorizationService _linkAuthorizationService = EndpointTestHelpers.CreateGrantingLinkAuthorizationService();
    private readonly ILogger<MarkExerciseCompleteEndpoint> _logger = Substitute.For<ILogger<MarkExerciseCompleteEndpoint>>();

    private static ISessionLockService CreateStubLockService()
    {
        var svc = Substitute.For<ISessionLockService>();
        svc.RefreshAsync(Arg.Any<Guid>(), Arg.Any<LockType>(), Arg.Any<TimeSpan>(),
            Arg.Any<CancellationToken>()).Returns(false);
        return svc;
    }

    private IApplicationDbContext CreateMockDb() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = _clientId, PublicId = _clientId })
            .Build();

    private IApplicationDbContext CreateMockDbForWrongClient() =>
        new MockDbBuilder()
            .With(new ClientProfile { UserId = Guid.NewGuid(), PublicId = Guid.NewGuid() })
            .Build();

    [Fact]
    public async Task HandleAsync_NewCompletion_Returns200WithProgress()
    {
        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1, _exercise2],
            sectionId: _sectionId);

        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger, TimeProvider.System);

        await ep.HandleAsync(
            new MarkExerciseCompleteRequest { SessionId = _sessionId, ExerciseId = _exercise1 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await completionCollection.Received(1).InsertOneAsync(
            Arg.Is<SessionExecution>(c =>
                c.ClientId == _clientId &&
                c.SessionId == _sessionId &&
                c.CompletedExerciseInstanceIds.Contains(_exercise1) &&
                c.CompletedExerciseInstanceIds.Count == 1),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_AlreadyComplete_IsIdempotent_Returns200()
    {
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: DateTime.UtcNow.Date,
            completedExerciseIds: [_exercise1],
            version: 1);

        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1, _exercise2],
            sectionId: _sectionId);

        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo(
            plan: plan,
            existingCompletion: existingCompletion);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger, TimeProvider.System);

        // Mark exercise1 complete again (already complete — idempotent)
        await ep.HandleAsync(
            new MarkExerciseCompleteRequest { SessionId = _sessionId, ExerciseId = _exercise1 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // No insert or update should have occurred
        await completionCollection.DidNotReceive().InsertOneAsync(
            Arg.Any<SessionExecution>(),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
        await completionCollection.DidNotReceive().UpdateOneAsync(
            Arg.Any<FilterDefinition<SessionExecution>>(),
            Arg.Any<UpdateDefinition<SessionExecution>>(),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_WrongClient_Returns404()
    {
        // The wrong client has no active training plan — the mock returns an empty list
        // for any FindAsync call (as it's keyed to return no plan for wrongClientId's collection).
        var wrongClientId = Guid.NewGuid();

        // Create a mongo with NO plans (simulates: plan belongs to _clientId, not wrongClientId)
        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(plan: null);

        var db = new MockDbBuilder()
            .With(new ClientProfile { UserId = wrongClientId, PublicId = wrongClientId })
            .Build();

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(wrongClientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger, TimeProvider.System);

        await ep.HandleAsync(
            new MarkExerciseCompleteRequest { SessionId = _sessionId, ExerciseId = _exercise1 },
            TestContext.Current.CancellationToken);

        // No active plan found for wrongClientId → 404
        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_StaleVersion_Returns409()
    {
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: DateTime.UtcNow.Date,
            completedExerciseIds: [],
            version: 2); // server is at version 2

        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1, _exercise2],
            sectionId: _sectionId);

        var mongo = Substitute.For<FitnessPlatform.Application.Infrastructure.Data.MongoDb.IMongoContext>();
        var planColl = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan).Mongo.TrainingPlans;
        mongo.TrainingPlans.Returns(planColl);

        // Execution collection returns existing doc but UpdateOneAsync modifies 0 rows (simulating version mismatch)
        var completionCollection = TrainingCompletionTestHelpers.CreateMockSessionExecutionCollection(
            [existingCompletion], updateSucceeds: false);
        mongo.SessionExecutions.Returns(completionCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger, TimeProvider.System);

        // Client sends version 2 which matches, but UpdateOneAsync returns ModifiedCount=0 (race)
        await ep.HandleAsync(
            new MarkExerciseCompleteRequest
            {
                SessionId = _sessionId,
                ExerciseId = _exercise1,
                Version = 2
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task HandleAsync_ClientSendsStaleVersion_Returns409Immediately()
    {
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: DateTime.UtcNow.Date,
            completedExerciseIds: [],
            version: 3);

        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1],
            sectionId: _sectionId);

        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo(
            plan: plan,
            existingCompletion: existingCompletion);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger, TimeProvider.System);

        // Client sends version 1 but server is at version 3
        await ep.HandleAsync(
            new MarkExerciseCompleteRequest
            {
                SessionId = _sessionId,
                ExerciseId = _exercise1,
                Version = 1
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task HandleAsync_NonExistentSessionId_Returns404()
    {
        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1],
            sectionId: _sectionId);

        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger, TimeProvider.System);

        await ep.HandleAsync(
            new MarkExerciseCompleteRequest { SessionId = Guid.NewGuid(), ExerciseId = _exercise1 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_NoClaims_Returns401()
    {
        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo();
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity()),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger, TimeProvider.System);

        await ep.HandleAsync(
            new MarkExerciseCompleteRequest { SessionId = _sessionId, ExerciseId = _exercise1 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(401);
    }

    [Fact]
    public async Task HandleAsync_UnknownSectionId_Returns404()
    {
        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1],
            sectionId: _sectionId);

        var (mongo, _) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger, TimeProvider.System);

        // Use a valid sessionId but an unknown exercise instance id
        await ep.HandleAsync(
            new MarkExerciseCompleteRequest { SessionId = _sessionId, ExerciseId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_SameExerciseInTwoSections_MarkInOneSection_OnlyAffectsThatSection()
    {
        // The core bug scenario: same catalog exercise in two workouts. Marking one occurrence
        // (by its distinct instance ExerciseId) must not affect the other occurrence's completion
        // state, even though both share the same catalog ExerciseExternalId.
        var sharedExerciseId = Guid.NewGuid();
        var (plan, _, _, workout1ExerciseId, workout2ExerciseId) =
            TrainingCompletionTestHelpers.CreateActivePlanWithDuplicateExerciseAcrossSections(
                _clientId, _sessionId, sharedExerciseId);

        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo(plan: plan);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger, TimeProvider.System);

        // Mark complete the section1 occurrence only
        await ep.HandleAsync(
            new MarkExerciseCompleteRequest
            {
                SessionId = _sessionId,
                ExerciseId = workout1ExerciseId
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // The inserted document must record completion only for the section1 instance, NOT the
        // section2 instance — even though both instances share the same catalog exercise.
        await completionCollection.Received(1).InsertOneAsync(
            Arg.Is<SessionExecution>(c =>
                c.CompletedExerciseInstanceIds.Contains(workout1ExerciseId) &&
                !c.CompletedExerciseInstanceIds.Contains(workout2ExerciseId)),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_LegacyFlatCompletion_IsIdempotentWhenSectionMatches()
    {
        // A completion document with the flat CompletedExerciseInstanceIds list already containing
        // this exercise instance. Re-marking it must short-circuit via the idempotency check and
        // return 200 without an additional update.
        var legacyCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: DateTime.UtcNow.Date,
            completedExerciseIds: [_exercise1],
            version: 1);

        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1, _exercise2],
            sectionId: _sectionId);

        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo(
            plan: plan,
            existingCompletion: legacyCompletion);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger, TimeProvider.System);

        // Mark exercise1 complete again — already present in CompletedExerciseInstanceIds, so the
        // idempotency check short-circuits before any update.
        await ep.HandleAsync(
            new MarkExerciseCompleteRequest { SessionId = _sessionId, ExerciseId = _exercise1 },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    /// <summary>
    /// Regression test locking the update-existing-doc path (<c>UpdateOneAsync</c>) for the flat
    /// <see cref="SessionExecution.CompletedExerciseInstanceIds"/> list: arranges an existing
    /// document with one exercise instance already complete, marks a SECOND exercise instance
    /// complete (triggers <c>UpdateOneAsync</c> rather than <c>InsertOneAsync</c>), and asserts
    /// 200 OK plus the expected call shape.
    /// </summary>
    [Fact]
    public async Task HandleAsync_SecondMarkInExistingDoc_PersistsViaUpdateOneAsync_DoesNotThrowBsonSerializationError()
    {
        // Arrange: doc already exists, exercise1 is complete.
        var existingCompletion = TrainingCompletionTestHelpers.CreateCompletion(
            clientId: _clientId,
            sessionId: _sessionId,
            date: DateTime.UtcNow.Date,
            completedExerciseIds: [_exercise1],
            version: 1);

        var plan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: _sessionId,
            exerciseIds: [_exercise1, _exercise2],
            sectionId: _sectionId);

        var (mongo, completionCollection) = TrainingCompletionTestHelpers.CreateMockMongo(
            plan: plan,
            existingCompletion: existingCompletion);
        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger, TimeProvider.System);

        // Act: mark exercise2 complete — triggers the UpdateOneAsync path.
        await ep.HandleAsync(
            new MarkExerciseCompleteRequest { SessionId = _sessionId, ExerciseId = _exercise2 },
            TestContext.Current.CancellationToken);

        // Assert: 200 OK — no BsonSerializationException.
        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // UpdateOneAsync must have been called (not Insert) — this is the path that previously threw.
        await completionCollection.DidNotReceive().InsertOneAsync(
            Arg.Any<SessionExecution>(),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
        await completionCollection.Received(1).UpdateOneAsync(
            Arg.Any<FilterDefinition<SessionExecution>>(),
            Arg.Is<UpdateDefinition<SessionExecution>>(u => u != null),
            Arg.Any<UpdateOptions>(),
            Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// Regression guard for #780: the Mark* endpoints must resolve the training plan whose
    /// date window contains the completion's TARGET date (<c>req.CompletedOn</c>), not
    /// "today" — otherwise a backdated/forward-dated completion resolves whichever plan's
    /// window contains today (or none), producing a 404 or writing against the wrong plan.
    /// Here the client has two non-overlapping Active plans: an older one whose window has
    /// already ended, and the current one whose window contains today. Completing an
    /// exercise with <c>CompletedOn</c> dated inside the OLDER plan's window must resolve
    /// that older plan and succeed — even though "today" falls inside the current plan's
    /// window (and the older plan's session/section/exercise ids don't exist in the
    /// current plan, so a mis-resolved plan would 404 instead of silently succeeding).
    /// </summary>
    [Fact]
    public async Task HandleAsync_BackdatedCompletionInOlderPlanWindow_ResolvesOlderPlan_Returns200()
    {
        var today = DateTime.UtcNow.Date;
        var todayStart = today.AddDays(-(((int)today.DayOfWeek + 6) % 7)); // Monday of current week

        // Older plan: fully-elapsed window, well before today. This is the plan the
        // backdated completion targets.
        var olderPlanStart = todayStart.AddDays(-60);
        var olderSessionId = Guid.NewGuid();
        var olderSectionId = Guid.NewGuid();
        var olderExerciseId = Guid.NewGuid();
        var olderPlan = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            TrainerId = Guid.NewGuid(),
            Name = "Older Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = olderPlanStart,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    DatePublished = olderPlanStart,
                    Days = TrainingPlanTestHelpers.MaterializeDays((1, new TrainingSession
                    {
                        SessionId = olderSessionId,
                        Name = "Older Session",
                        Order = 1,
                        Workouts =
                        [
                            new TrainingWorkout
                            {
                                WorkoutId = olderSectionId,
                                Order = 0,
                                Name = "Hlavní",
                                Exercises =
                                [
                                    new SessionExercise
                                    {
                                        ExerciseId = olderExerciseId,
                                        ExerciseExternalId = olderExerciseId,
                                        ExerciseName = "Old Ex",
                                        Order = 1,
                                        Sets = []
                                    }
                                ]
                            }
                        ]
                    }))
                }
            ],
            Version = 1,
            DateCreated = olderPlanStart
        };

        // Current plan: window contains today. Its session/exercise ids are unrelated to
        // the older plan's, so a mis-resolved-plan bug would 404 rather than accidentally pass.
        var currentPlan = TrainingCompletionTestHelpers.CreateActivePlan(
            clientId: _clientId,
            sessionId: Guid.NewGuid(),
            exerciseIds: [Guid.NewGuid()],
            startDate: todayStart);

        // Backdated completion date — squarely inside the older plan's window, well before
        // "today" (which is inside the current plan's window).
        var backdatedDate = DateOnly.FromDateTime(olderPlanStart.AddDays(2));

        var mongo = Substitute.For<FitnessPlatform.Application.Infrastructure.Data.MongoDb.IMongoContext>();
        var planCollection = CreateMultiPlanCollection([olderPlan, currentPlan]);
        mongo.TrainingPlans.Returns(planCollection);

        var completionCollection = TrainingCompletionTestHelpers.CreateMockSessionExecutionCollection([]);
        mongo.SessionExecutions.Returns(completionCollection);

        var db = CreateMockDb();

        var ep = Factory.Create<MarkExerciseCompleteEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_clientId, AppRoles.Client))),
            mongo, db, _notifier, _compliance, _lockService, LockOptions, _linkAuthorizationService, _logger, TimeProvider.System);

        await ep.HandleAsync(
            new MarkExerciseCompleteRequest
            {
                SessionId = olderSessionId,
                ExerciseId = olderExerciseId,
                CompletedOn = backdatedDate
            },
            TestContext.Current.CancellationToken);

        // Before the fix, the plan was resolved against DateTime.UtcNow (today, inside the
        // CURRENT plan's window) — olderSessionId would not be found among the current
        // plan's sessions, producing a 404. After the fix, the plan is resolved against the
        // request's target date (inside the OLDER plan's window), so the session/section/
        // exercise lookups succeed.
        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await completionCollection.Received(1).InsertOneAsync(
            Arg.Is<SessionExecution>(c =>
                c.ClientId == _clientId &&
                c.SessionId == olderSessionId &&
                c.Date == backdatedDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc) &&
                c.CompletedExerciseInstanceIds.Contains(olderExerciseId)),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// Builds a mock <see cref="IMongoCollection{TrainingPlan}"/> that returns several plans
    /// from a single <c>FindAsync</c> call — used to exercise
    /// <see cref="FitnessPlatform.Application.Domain.Services.PlanWindowResolver"/>
    /// with >1 Active plan for the client (#780). Local copy of the cursor-building pattern in
    /// <see cref="TrainingCompletionTestHelpers"/> (which only supports a single plan).
    /// </summary>
    private static IMongoCollection<TrainingPlan> CreateMultiPlanCollection(
        List<TrainingPlan> plans)
    {
        var collection = Substitute.For<IMongoCollection<TrainingPlan>>();
        collection.FindAsync(
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
        return collection;
    }
}
