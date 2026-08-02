using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.TrainingPlans.FinishSession;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace FitnessPlatform.Tests.Endpoints.TrainingPlans;

/// <summary>
/// Tests for <see cref="FinishSessionEndpoint"/>.
/// #841: the endpoint now reads/writes exclusively <see cref="IMongoContext.SessionExecutions"/> —
/// fixtures here build <see cref="SessionExecution"/> documents instead of the retired
/// <c>WorkoutLog</c>.
/// </summary>
public class FinishSessionEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();

    // ── helpers ──────────────────────────────────────────────────────────────────

    private IWorkoutCompletionService StubCompletionService()
    {
        var svc = Substitute.For<IWorkoutCompletionService>();
        svc.CompleteAsync(Arg.Any<SessionExecution>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns(new List<string>());
        return svc;
    }

    private static TrainingPlan CreatePlanWithSession(
        Guid trainerId,
        Guid sessionId,
        Guid? clientId = null,
        DateTime? startDate = null)
    {
        var sectionId = Guid.NewGuid();
        return new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = clientId ?? Guid.NewGuid(),
            TrainerId = trainerId,
            Name = "Test Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = startDate ?? DateTime.UtcNow.Date.AddDays(-30),
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
                            Name = "Push Day",
                            Order = 1,
                            Workouts =
                            [
                                new TrainingWorkout
                                {
                                    WorkoutId = sectionId,
                                    Order = 0,
                                    Name = "Hlavní",
                                    Exercises =
                                    [
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = Guid.NewGuid(),
                                            ExerciseName = "Bench Press",
                                            Order = 1,
                                            Sets =
                                            [
                                                new ExerciseSet { SetNumber = 1, Reps = 10, WeightKg = 100 },
                                                new ExerciseSet { SetNumber = 2, Reps = 10, WeightKg = 100 }
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
            DateCreated = DateTime.UtcNow.AddDays(-30)
        };
    }

    private static SessionExecution CreateIncompleteExecution(TrainingPlan plan, Guid sessionId, DateTime? startedAt = null)
    {
        var started = startedAt ?? DateTime.UtcNow.AddDays(-3);
        return new SessionExecution
        {
            ExternalId = Guid.NewGuid(),
            ClientId = plan.ClientId,
            PlanId = plan.ExternalId,
            SessionId = sessionId,
            Date = SessionExecution.ToCompletionDateUtc(started),
            Status = SessionExecutionStatus.Partial,
            Performance = new SessionExecutionPerformance { StartedAt = started, Sections = [] },
            DateCreated = started,
            Version = 1
        };
    }

    private static SessionExecution CreateCompletedExecution(TrainingPlan plan, Guid sessionId, DateTime? startedAt = null)
    {
        var started = startedAt ?? DateTime.UtcNow.AddDays(-1);
        var completedAt = started.AddHours(1);
        return new SessionExecution
        {
            ExternalId = Guid.NewGuid(),
            ClientId = plan.ClientId,
            PlanId = plan.ExternalId,
            SessionId = sessionId,
            Date = SessionExecution.ToCompletionDateUtc(completedAt),
            Status = SessionExecutionStatus.Completed,
            Performance = new SessionExecutionPerformance { StartedAt = started, CompletedAt = completedAt, Sections = [] },
            DateCreated = started,
            Version = 1
        };
    }

    private static (IMongoContext Mongo, IMongoCollection<SessionExecution> ExecutionCollection) CreateMockMongoWithInsert(
        TrainingPlan plan,
        IReadOnlyList<SessionExecution> existingExecutions)
    {
        var mongo = Substitute.For<IMongoContext>();

        // Plans collection
        var planCollection = TrainingPlanTestHelpers.CreateMockCollection([plan]);
        mongo.TrainingPlans.Returns(planCollection);

        // SessionExecutions collection with FindAsync + InsertOneAsync + ReplaceOneAsync
        var executionCollection = TrainingPlanTestHelpers.CreateMockSessionExecutionCollection(existingExecutions.ToList());
        mongo.SessionExecutions.Returns(executionCollection);

        return (mongo, executionCollection);
    }

    // ── happy path: session has an incomplete execution (skipped) ────────────────

    [Fact]
    public async Task HandleAsync_SkippedSession_CompletesExistingLog_Returns200()
    {
        var sessionId = Guid.NewGuid();
        var plan = CreatePlanWithSession(_trainerId, sessionId);
        var incompleteExecution = CreateIncompleteExecution(plan, sessionId);

        var (mongo, _) = CreateMockMongoWithInsert(plan, [incompleteExecution]);
        var completionService = StubCompletionService();

        var ep = Factory.Create<FinishSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, completionService);

        await ep.HandleAsync(
            new FinishSessionRequest { PlanId = plan.ExternalId, SessionId = sessionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // The existing incomplete execution must be passed to the service — no InsertOneAsync.
        await completionService.Received(1).CompleteAsync(
            Arg.Is<SessionExecution>(l => l.ExternalId == incompleteExecution.ExternalId),
            Arg.Any<DateTime>(),
            Arg.Any<CancellationToken>());
    }

    // ── happy path: no prior execution (untouched) — materializes from template ──

    [Fact]
    public async Task HandleAsync_UntouchedSession_MaterializesLogFromTemplate_Returns200()
    {
        var sessionId = Guid.NewGuid();
        var plan = CreatePlanWithSession(_trainerId, sessionId);

        var (mongo, executionCollection) = CreateMockMongoWithInsert(plan, []);
        var completionService = StubCompletionService();

        var ep = Factory.Create<FinishSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, completionService);

        await ep.HandleAsync(
            new FinishSessionRequest { PlanId = plan.ExternalId, SessionId = sessionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // A new execution must be inserted, keyed on plan.ClientId directly — TrainingPlan.ClientId
        // is ApplicationUser.Id since #840, the same convention SessionExecution.ClientId has
        // always used, so no ClientProfile translation happens anymore.
        await executionCollection.Received(1).InsertOneAsync(
            Arg.Is<SessionExecution>(l =>
                l.PlanId == plan.ExternalId &&
                l.SessionId == sessionId &&
                l.ClientId == plan.ClientId &&
                l.Status == SessionExecutionStatus.Partial &&
                l.Performance!.Sections.Count > 0),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());

        // Section structure must be preserved (not flat list).
        await completionService.Received(1).CompleteAsync(
            Arg.Is<SessionExecution>(l =>
                l.PlanId == plan.ExternalId &&
                l.SessionId == sessionId &&
                l.Performance!.Sections.Count > 0 &&
                l.Performance!.Sections[0].Exercises.Count > 0),
            Arg.Any<DateTime>(),
            Arg.Any<CancellationToken>());
    }

    // ── WorkoutSet planned fields are mapped from ExerciseSet ────────────────────

    [Fact]
    public async Task HandleAsync_UntouchedSession_MapsPlannedSetsFromTemplate()
    {
        var sessionId = Guid.NewGuid();
        var plan = CreatePlanWithSession(_trainerId, sessionId);

        var (mongo, _) = CreateMockMongoWithInsert(plan, []);
        var completionService = StubCompletionService();

        SessionExecution? capturedLog = null;
        completionService.CompleteAsync(
                Arg.Do<SessionExecution>(l => capturedLog = l),
                Arg.Any<DateTime>(),
                Arg.Any<CancellationToken>())
            .Returns(new List<string>());

        var ep = Factory.Create<FinishSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, completionService);

        await ep.HandleAsync(
            new FinishSessionRequest { PlanId = plan.ExternalId, SessionId = sessionId },
            TestContext.Current.CancellationToken);

        capturedLog.Should().NotBeNull();
        var sets = capturedLog!.Performance!.Sections[0].Exercises[0].Sets;
        sets.Should().HaveCount(2);
        sets[0].SetNumber.Should().Be(1);
        sets[0].Reps.Should().Be(10);
        sets[0].WeightKg.Should().Be(100);
        sets[0].CompletedAt.Should().NotBeNull();
        sets[0].IsPR.Should().BeFalse(); // PR detection is left to the service
    }

    // ── backdated finish: SessionExecution.Date must use completedAt's day ──────

    [Fact]
    public async Task HandleAsync_BackdatedFinish_PassesBackdatedInstantToService()
    {
        var sessionId = Guid.NewGuid();
        var plan = CreatePlanWithSession(_trainerId, sessionId);
        var backdated = DateTime.UtcNow.Date.AddDays(-7).AddHours(14); // last week

        var (mongo, _) = CreateMockMongoWithInsert(plan, []);
        var completionService = StubCompletionService();

        var ep = Factory.Create<FinishSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, completionService);

        await ep.HandleAsync(
            new FinishSessionRequest
            {
                PlanId = plan.ExternalId,
                SessionId = sessionId,
                CompletedAt = backdated
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // The service must receive exactly the backdated instant (not UtcNow).
        await completionService.Received(1).CompleteAsync(
            Arg.Any<SessionExecution>(),
            Arg.Is<DateTime>(d => d == backdated),
            Arg.Any<CancellationToken>());
    }

    // ── parity with client live-finish: same service, same pipeline ──────────────

    [Fact]
    public async Task HandleAsync_CallsCompletionServiceWithCorrectLog()
    {
        // This test proves the trainer path uses the SAME completion pipeline as the client.
        // Both endpoints call IWorkoutCompletionService.CompleteAsync; the AC "doc parity"
        // is structural — PR detection, completion-flag population, and notification all
        // happen inside the same service regardless of who triggers the finish.
        var sessionId = Guid.NewGuid();
        var plan = CreatePlanWithSession(_trainerId, sessionId);
        var incompleteExecution = CreateIncompleteExecution(plan, sessionId, DateTime.UtcNow.AddDays(-2));

        var (mongo, _) = CreateMockMongoWithInsert(plan, [incompleteExecution]);
        var completionService = StubCompletionService();

        var ep = Factory.Create<FinishSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, completionService);

        await ep.HandleAsync(
            new FinishSessionRequest { PlanId = plan.ExternalId, SessionId = sessionId },
            TestContext.Current.CancellationToken);

        // The service is called once — meaning the same pipeline runs.
        await completionService.Received(1).CompleteAsync(
            Arg.Any<SessionExecution>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>());
    }

    // ── ownership guard: trainer doesn't own the plan ────────────────────────────

    [Fact]
    public async Task HandleAsync_PlanOwnedByOtherTrainer_Returns404()
    {
        var sessionId = Guid.NewGuid();
        var otherTrainerId = Guid.NewGuid();
        var plan = CreatePlanWithSession(otherTrainerId, sessionId);

        var (mongo, _) = CreateMockMongoWithInsert(plan, []);

        var ep = Factory.Create<FinishSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, StubCompletionService());

        await ep.HandleAsync(
            new FinishSessionRequest { PlanId = plan.ExternalId, SessionId = sessionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_PlanNotFound_Returns404()
    {
        var mongo = Substitute.For<IMongoContext>();
        var emptyPlanCollection = TrainingPlanTestHelpers.CreateMockCollection([]);
        mongo.TrainingPlans.Returns(emptyPlanCollection);

        var ep = Factory.Create<FinishSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, StubCompletionService());

        await ep.HandleAsync(
            new FinishSessionRequest { PlanId = Guid.NewGuid(), SessionId = Guid.NewGuid() },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    [Fact]
    public async Task HandleAsync_SessionNotFoundInPlan_Returns404()
    {
        var plan = CreatePlanWithSession(_trainerId, Guid.NewGuid());
        var wrongSessionId = Guid.NewGuid(); // not in the plan

        var (mongo, _) = CreateMockMongoWithInsert(plan, []);

        var ep = Factory.Create<FinishSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, StubCompletionService());

        await ep.HandleAsync(
            new FinishSessionRequest { PlanId = plan.ExternalId, SessionId = wrongSessionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }

    // ── already-completed reject ─────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_AlreadyCompleted_Returns409()
    {
        var sessionId = Guid.NewGuid();
        var plan = CreatePlanWithSession(_trainerId, sessionId);
        var completedExecution = CreateCompletedExecution(plan, sessionId);

        var (mongo, _) = CreateMockMongoWithInsert(plan, [completedExecution]);

        var ep = Factory.Create<FinishSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, StubCompletionService());

        await ep.HandleAsync(
            new FinishSessionRequest { PlanId = plan.ExternalId, SessionId = sessionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);
    }

    // ── future-date reject ───────────────────────────────────────────────────────

    [Fact]
    public async Task HandleAsync_FutureCompletedAt_Returns400()
    {
        // The validator rejects future dates; FastEndpoints returns 400 before HandleAsync runs.
        // This test drives via the validator directly.
        var futureDate = DateTime.UtcNow.AddHours(1);
        var validator = new FinishSessionValidator();
        var req = new FinishSessionRequest
        {
            PlanId = Guid.NewGuid(),
            SessionId = Guid.NewGuid(),
            CompletedAt = futureDate
        };

        var result = await validator.ValidateAsync(req, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(e => e.ErrorCode == "COMPLETED_AT_IN_FUTURE");
    }

    // ── completedAt before plan start date ───────────────────────────────────────

    [Fact]
    public async Task HandleAsync_CompletedAtBeforePlanStart_Returns422()
    {
        var sessionId = Guid.NewGuid();
        var planStart = DateTime.UtcNow.Date.AddDays(-7);
        var plan = CreatePlanWithSession(_trainerId, sessionId, startDate: planStart);

        var completedAtBeforeStart = planStart.AddDays(-1); // one day before plan started

        var (mongo, _) = CreateMockMongoWithInsert(plan, []);

        var ep = Factory.Create<FinishSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, StubCompletionService());

        await ep.HandleAsync(
            new FinishSessionRequest
            {
                PlanId = plan.ExternalId,
                SessionId = sessionId,
                CompletedAt = completedAtBeforeStart
            },
            TestContext.Current.CancellationToken);

        // ThrowErrorWithCode maps to 422 Unprocessable Entity in FastEndpoints.
        ep.HttpContext.Response.StatusCode.Should().Be(422);
    }

    // ── MINOR-1: null StartDate floor falls back to DateCreated ──────────────────

    [Fact]
    public async Task HandleAsync_NullStartDate_CompletedAtBeforeDateCreated_Returns422()
    {
        // Arrange: plan has no StartDate (not yet started). completedAt is before DateCreated —
        // the plan didn't exist yet, so the write would fabricate impossible history.
        var sessionId = Guid.NewGuid();
        var dateCreated = DateTime.UtcNow.AddDays(-14);

        // Pass startDate: null explicitly by using the overload that leaves StartDate as its default.
        var planWithNullStart = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = Guid.NewGuid(),
            TrainerId = _trainerId,
            Name = "Plan Without Start",
            Status = TrainingPlanStatus.Active,
            StartDate = null, // explicitly no start date
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
                            Name = "Push Day",
                            Order = 1,
                            Workouts = []
                        }
                    ]
                }
            ],
            Version = 1,
            DateCreated = dateCreated
        };

        var (mongo, _) = CreateMockMongoWithInsert(planWithNullStart, []);

        var ep = Factory.Create<FinishSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, StubCompletionService());

        // completedAt is one day before the plan was created — must be rejected
        var tooEarly = dateCreated.AddDays(-1);

        await ep.HandleAsync(
            new FinishSessionRequest
            {
                PlanId = planWithNullStart.ExternalId,
                SessionId = sessionId,
                CompletedAt = tooEarly
            },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(422);
    }

    // ── TOCTOU backstop: WorkoutAlreadyCompletedException → 409 ─────────────────

    [Fact]
    public async Task HandleAsync_WorkoutAlreadyCompleted_Returns409()
    {
        // When the in-process guard passed (no existing completed execution) but the index
        // rejected the write (TOCTOU race — two concurrent requests), the endpoint must
        // map WorkoutAlreadyCompletedException to 409, not 500.
        var sessionId = Guid.NewGuid();
        var plan = CreatePlanWithSession(_trainerId, sessionId);

        var (mongo, _) = CreateMockMongoWithInsert(plan, []);

        var completionService = Substitute.For<IWorkoutCompletionService>();
        completionService
            .CompleteAsync(Arg.Any<SessionExecution>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Throws(new WorkoutAlreadyCompletedException());

        var ep = Factory.Create<FinishSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, completionService);

        await ep.HandleAsync(
            new FinishSessionRequest { PlanId = plan.ExternalId, SessionId = sessionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409,
            "WorkoutAlreadyCompletedException from the TOCTOU backstop must be surfaced as 409, not 500");
    }

    // ── MINOR-2: non-UTC completedAt is normalized before validation ──────────────

    [Fact]
    public async Task HandleAsync_UnspecifiedKindCompletedAt_NormalizedToUtc_Returns200()
    {
        // Arrange: completedAt arrives with DateTimeKind.Unspecified (as JSON binders produce).
        // The endpoint must normalize via ToUniversalTime() so the completion lands on the
        // correct calendar day. This test verifies that a value within a valid range still
        // succeeds — the normalization must not corrupt the value.
        var sessionId = Guid.NewGuid();
        var plan = CreatePlanWithSession(_trainerId, sessionId);

        var (mongo, _) = CreateMockMongoWithInsert(plan, []);
        var completionService = StubCompletionService();

        var ep = Factory.Create<FinishSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, completionService);

        // Simulate JSON-bound DateTime with Unspecified kind (equivalent to a UTC instant one week ago)
        var rawFromJson = DateTime.SpecifyKind(DateTime.UtcNow.AddDays(-5), DateTimeKind.Unspecified);

        await ep.HandleAsync(
            new FinishSessionRequest
            {
                PlanId = plan.ExternalId,
                SessionId = sessionId,
                CompletedAt = rawFromJson
            },
            TestContext.Current.CancellationToken);

        // Should succeed — value is valid once normalized
        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // The service must receive a UTC-kind DateTime
        await completionService.Received(1).CompleteAsync(
            Arg.Any<SessionExecution>(),
            Arg.Is<DateTime>(d => d.Kind == DateTimeKind.Utc),
            Arg.Any<CancellationToken>());
    }

    // ── #841: completion flags land on the SAME SessionExecution document ────────

    [Fact]
    public async Task HandleAsync_UntouchedSession_WritesCompletionFlagsOnSessionExecution()
    {
        // Exercises the REAL WorkoutCompletionService (not the stub) to prove the end-to-end
        // pipeline: plan.ClientId (ApplicationUser.Id since #840) flows straight onto the
        // materialized SessionExecution.ClientId, and WorkoutCompletionService populates the
        // completion flags directly on that SAME document — #841 retired the separate
        // TrainingCompletion fan-out write, so there is no second collection to assert against.
        var sessionId = Guid.NewGuid();
        var plan = CreatePlanWithSession(_trainerId, sessionId);

        var (mongo, executionCollection) = CreateMockMongoWithInsert(plan, []);

        var prDetection = Substitute.For<IPrDetectionService>();
        prDetection.DetectAndMarkPRsAsync(Arg.Any<SessionExecution>(), Arg.Any<CancellationToken>())
            .Returns(new List<string>());
        var notifications = Substitute.For<INotificationService>();
        var logger = Substitute.For<ILogger<WorkoutCompletionService>>();

        var completionService = new WorkoutCompletionService(mongo, prDetection, notifications, logger);

        var ep = Factory.Create<FinishSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, completionService);

        await ep.HandleAsync(
            new FinishSessionRequest { PlanId = plan.ExternalId, SessionId = sessionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // The real completion pipeline must have replaced the SessionExecution document with
        // the completion flags populated (plan.ClientId is ApplicationUser.Id) and Status=Completed
        // — no separate TrainingCompletion write happens any more.
        await executionCollection.Received().ReplaceOneAsync(
            Arg.Any<FilterDefinition<SessionExecution>>(),
            Arg.Is<SessionExecution>(e =>
                e.ClientId == plan.ClientId &&
                e.SessionId == sessionId &&
                e.Status == SessionExecutionStatus.Completed &&
                e.CompletedWorkoutIds != null && e.CompletedWorkoutIds.Count > 0),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }
}
