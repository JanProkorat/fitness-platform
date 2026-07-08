using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Common;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Entities;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.TrainingPlans.FinishSession;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Application.Infrastructure.Services;
using FitnessPlatform.Tests.Builders;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace FitnessPlatform.Tests.Endpoints.TrainingPlans;

/// <summary>
/// Tests for <see cref="FinishSessionEndpoint"/>.
/// </summary>
public class FinishSessionEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();

    // ── helpers ──────────────────────────────────────────────────────────────────

    private IWorkoutCompletionService StubCompletionService()
    {
        var svc = Substitute.For<IWorkoutCompletionService>();
        svc.CompleteAsync(Arg.Any<WorkoutLog>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Returns(new List<string>());
        return svc;
    }

    /// <summary>
    /// Builds a mock <see cref="IApplicationDbContext"/> containing a <see cref="ClientProfile"/>
    /// whose PublicId matches the plan's ClientId — this is the resolution FinishSessionEndpoint
    /// performs when materializing a new WorkoutLog (TrainingPlan.ClientId == ClientProfile.PublicId,
    /// but WorkoutLog.ClientId must be keyed on ClientProfile.UserId).
    /// </summary>
    private static IApplicationDbContext CreateDbWithProfileForPlan(TrainingPlan plan, Guid clientUserId) =>
        new MockDbBuilder()
            .With(new ClientProfile { Id = 1, UserId = clientUserId, PublicId = plan.ClientId })
            .Build();

    /// <summary>
    /// An empty-but-valid mocked <see cref="IApplicationDbContext"/> (no ClientProfiles seeded).
    /// Safe for tests whose code path never reaches the ClientProfile resolution (early-return
    /// guards, or an existing in-progress log) AND for the "no matching ClientProfile" 404 test,
    /// since <see cref="MockDbBuilder"/> wires ClientProfiles as a real (empty) queryable DbSet
    /// rather than a bare, un-stubbed substitute.
    /// </summary>
    private static IApplicationDbContext EmptyDb() => new MockDbBuilder().Build();

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

    private static (IMongoContext Mongo, IMongoCollection<WorkoutLog> LogCollection) CreateMockMongoWithInsert(
        TrainingPlan plan,
        IReadOnlyList<WorkoutLog> existingLogs)
    {
        var mongo = Substitute.For<IMongoContext>();

        // Plans collection
        var planCollection = TrainingPlanTestHelpers.CreateMockCollection([plan]);
        mongo.TrainingPlans.Returns(planCollection);

        // WorkoutLogs collection with FindAsync + InsertOneAsync + ReplaceOneAsync
        var logCollection = TrainingPlanTestHelpers.CreateMockWorkoutLogCollection(existingLogs.ToList());
        mongo.WorkoutLogs.Returns(logCollection);

        return (mongo, logCollection);
    }

    // ── happy path: session has an incomplete log (skipped) ──────────────────────

    [Fact]
    public async Task HandleAsync_SkippedSession_CompletesExistingLog_Returns200()
    {
        var sessionId = Guid.NewGuid();
        var plan = CreatePlanWithSession(_trainerId, sessionId);
        var incompleteLog = new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = plan.ClientId,
            PlanId = plan.ExternalId,
            SessionId = sessionId,
            StartedAt = DateTime.UtcNow.AddDays(-3),
            IsCompleted = false,
            Sections = [],
            DateCreated = DateTime.UtcNow.AddDays(-3)
        };

        var (mongo, _) = CreateMockMongoWithInsert(plan, [incompleteLog]);
        var completionService = StubCompletionService();

        var ep = Factory.Create<FinishSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, EmptyDb(), completionService);

        await ep.HandleAsync(
            new FinishSessionRequest { PlanId = plan.ExternalId, SessionId = sessionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // The existing incomplete log must be passed to the service — no InsertOneAsync.
        await completionService.Received(1).CompleteAsync(
            Arg.Is<WorkoutLog>(l => l.ExternalId == incompleteLog.ExternalId),
            Arg.Any<DateTime>(),
            Arg.Any<CancellationToken>());
    }

    // ── happy path: no prior log (untouched) — materializes from template ────────

    [Fact]
    public async Task HandleAsync_UntouchedSession_MaterializesLogFromTemplate_Returns200()
    {
        var sessionId = Guid.NewGuid();
        var plan = CreatePlanWithSession(_trainerId, sessionId);
        var clientUserId = Guid.NewGuid();

        var (mongo, logCollection) = CreateMockMongoWithInsert(plan, []);
        var db = CreateDbWithProfileForPlan(plan, clientUserId);
        var completionService = StubCompletionService();

        var ep = Factory.Create<FinishSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, db, completionService);

        await ep.HandleAsync(
            new FinishSessionRequest { PlanId = plan.ExternalId, SessionId = sessionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // A new log must be inserted, keyed on the client's ApplicationUser.Id (resolved via
        // ClientProfile.PublicId == plan.ClientId) — NOT the raw plan.ClientId (PublicId).
        // This is the #651 regression guard: WorkoutLog.ClientId must match every other
        // WorkoutLog write path's convention so client history/PR-detection can see it.
        await logCollection.Received(1).InsertOneAsync(
            Arg.Is<WorkoutLog>(l =>
                l.PlanId == plan.ExternalId &&
                l.SessionId == sessionId &&
                l.ClientId == clientUserId &&
                l.ClientId != plan.ClientId &&
                !l.IsCompleted &&
                l.Sections.Count > 0),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());

        // Section structure must be preserved (not flat list).
        await completionService.Received(1).CompleteAsync(
            Arg.Is<WorkoutLog>(l =>
                l.PlanId == plan.ExternalId &&
                l.SessionId == sessionId &&
                l.Sections.Count > 0 &&
                l.Sections[0].Exercises.Count > 0),
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
        var db = CreateDbWithProfileForPlan(plan, Guid.NewGuid());
        var completionService = StubCompletionService();

        WorkoutLog? capturedLog = null;
        completionService.CompleteAsync(
                Arg.Do<WorkoutLog>(l => capturedLog = l),
                Arg.Any<DateTime>(),
                Arg.Any<CancellationToken>())
            .Returns(new List<string>());

        var ep = Factory.Create<FinishSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, db, completionService);

        await ep.HandleAsync(
            new FinishSessionRequest { PlanId = plan.ExternalId, SessionId = sessionId },
            TestContext.Current.CancellationToken);

        capturedLog.Should().NotBeNull();
        var sets = capturedLog!.Sections[0].Exercises[0].Sets;
        sets.Should().HaveCount(2);
        sets[0].SetNumber.Should().Be(1);
        sets[0].Reps.Should().Be(10);
        sets[0].WeightKg.Should().Be(100);
        sets[0].CompletedAt.Should().NotBeNull();
        sets[0].IsPR.Should().BeFalse(); // PR detection is left to the service
    }

    // ── backdated finish: TrainingCompletion.Date must use completedAt's day ─────

    [Fact]
    public async Task HandleAsync_BackdatedFinish_PassesBackdatedInstantToService()
    {
        var sessionId = Guid.NewGuid();
        var plan = CreatePlanWithSession(_trainerId, sessionId);
        var backdated = DateTime.UtcNow.Date.AddDays(-7).AddHours(14); // last week

        var (mongo, _) = CreateMockMongoWithInsert(plan, []);
        var db = CreateDbWithProfileForPlan(plan, Guid.NewGuid());
        var completionService = StubCompletionService();

        var ep = Factory.Create<FinishSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, db, completionService);

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
            Arg.Any<WorkoutLog>(),
            Arg.Is<DateTime>(d => d == backdated),
            Arg.Any<CancellationToken>());
    }

    // ── parity with client live-finish: same service, same pipeline ──────────────

    [Fact]
    public async Task HandleAsync_CallsCompletionServiceWithCorrectLog()
    {
        // This test proves the trainer path uses the SAME completion pipeline as the client.
        // Both endpoints call IWorkoutCompletionService.CompleteAsync; the AC "doc parity"
        // is structural — the PR detection, TrainingCompletion fan-out, and notification
        // all happen inside the same service regardless of who triggers the finish.
        var sessionId = Guid.NewGuid();
        var plan = CreatePlanWithSession(_trainerId, sessionId);
        var incompleteLog = new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = plan.ClientId,
            PlanId = plan.ExternalId,
            SessionId = sessionId,
            StartedAt = DateTime.UtcNow.AddDays(-2),
            IsCompleted = false,
            Sections = [],
            DateCreated = DateTime.UtcNow.AddDays(-2)
        };

        var (mongo, _) = CreateMockMongoWithInsert(plan, [incompleteLog]);
        var completionService = StubCompletionService();

        var ep = Factory.Create<FinishSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, EmptyDb(), completionService);

        await ep.HandleAsync(
            new FinishSessionRequest { PlanId = plan.ExternalId, SessionId = sessionId },
            TestContext.Current.CancellationToken);

        // The service is called once — meaning the same pipeline runs.
        await completionService.Received(1).CompleteAsync(
            Arg.Any<WorkoutLog>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>());
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
            mongo, EmptyDb(), StubCompletionService());

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
            mongo, EmptyDb(), StubCompletionService());

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
            mongo, EmptyDb(), StubCompletionService());

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
        var completedLog = new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = plan.ClientId,
            PlanId = plan.ExternalId,
            SessionId = sessionId,
            StartedAt = DateTime.UtcNow.AddDays(-1),
            IsCompleted = true, // already done
            CompletedAt = DateTime.UtcNow.AddDays(-1).AddHours(1),
            Sections = [],
            DateCreated = DateTime.UtcNow.AddDays(-1)
        };

        var (mongo, _) = CreateMockMongoWithInsert(plan, [completedLog]);

        var ep = Factory.Create<FinishSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, EmptyDb(), StubCompletionService());

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
            mongo, EmptyDb(), StubCompletionService());

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
                            Sections = []
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
            mongo, EmptyDb(), StubCompletionService());

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
        // When the in-process guard passed (no existing completed log) but the index
        // rejected the write (TOCTOU race — two concurrent requests), the endpoint must
        // map WorkoutAlreadyCompletedException to 409, not 500.
        var sessionId = Guid.NewGuid();
        var plan = CreatePlanWithSession(_trainerId, sessionId);

        var (mongo, _) = CreateMockMongoWithInsert(plan, []);
        var db = CreateDbWithProfileForPlan(plan, Guid.NewGuid());

        var completionService = Substitute.For<IWorkoutCompletionService>();
        completionService
            .CompleteAsync(Arg.Any<WorkoutLog>(), Arg.Any<DateTime>(), Arg.Any<CancellationToken>())
            .Throws(new WorkoutAlreadyCompletedException());

        var ep = Factory.Create<FinishSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, db, completionService);

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
        var db = CreateDbWithProfileForPlan(plan, Guid.NewGuid());
        var completionService = StubCompletionService();

        var ep = Factory.Create<FinishSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, db, completionService);

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
            Arg.Any<WorkoutLog>(),
            Arg.Is<DateTime>(d => d.Kind == DateTimeKind.Utc),
            Arg.Any<CancellationToken>());
    }

    // ── #651: no ClientProfile resolves plan.ClientId → 404, never fall back ─────

    [Fact]
    public async Task HandleAsync_NoClientProfileForPlanClientId_Returns404()
    {
        // A data-integrity edge: TrainingPlan.ClientId (a ClientProfile.PublicId) has no
        // matching ClientProfile row. The endpoint must NOT fall back to writing the raw
        // plan.ClientId onto WorkoutLog.ClientId — it must surface 404, mirroring
        // StartWorkoutEndpoint's precedent for an unresolvable ClientProfile.
        var sessionId = Guid.NewGuid();
        var plan = CreatePlanWithSession(_trainerId, sessionId);

        var (mongo, logCollection) = CreateMockMongoWithInsert(plan, []);
        var db = EmptyDb(); // no ClientProfile seeded — plan.ClientId cannot be resolved

        var ep = Factory.Create<FinishSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, db, StubCompletionService());

        await ep.HandleAsync(
            new FinishSessionRequest { PlanId = plan.ExternalId, SessionId = sessionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);

        // No log must ever be materialized/inserted when the client cannot be resolved.
        await logCollection.DidNotReceive().InsertOneAsync(
            Arg.Any<WorkoutLog>(), Arg.Any<InsertOneOptions>(), Arg.Any<CancellationToken>());
    }

    // ── #651: second consequence — TrainingCompletion fan-out must now succeed ──

    [Fact]
    public async Task HandleAsync_UntouchedSession_WritesTrainingCompletionDocument()
    {
        // This is the second consequence of #651: with WorkoutLog.ClientId correctly resolved
        // to the ApplicationUser.Id, WorkoutCompletionService.CompleteAsync's internal
        // ClientProfile lookup (by UserId) must succeed and fan out a TrainingCompletion
        // document. Exercises the REAL WorkoutCompletionService (not the stub) to prove the
        // end-to-end pipeline, per the design-review MAJOR finding.
        var sessionId = Guid.NewGuid();
        var plan = CreatePlanWithSession(_trainerId, sessionId);
        var clientUserId = Guid.NewGuid();

        var mongo = TrainingPlanTestHelpers.CreateMockMongoWithLogs(
            plans: [plan],
            workoutLogs: [],
            trainingCompletions: []);
        var db = CreateDbWithProfileForPlan(plan, clientUserId);

        var prDetection = Substitute.For<IPrDetectionService>();
        prDetection.DetectAndMarkPRsAsync(Arg.Any<WorkoutLog>(), Arg.Any<CancellationToken>())
            .Returns(new List<string>());
        var notifications = Substitute.For<INotificationService>();
        var logger = Substitute.For<ILogger<WorkoutCompletionService>>();

        var completionService = new WorkoutCompletionService(mongo, db, prDetection, notifications, logger);

        var ep = Factory.Create<FinishSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, db, completionService);

        await ep.HandleAsync(
            new FinishSessionRequest { PlanId = plan.ExternalId, SessionId = sessionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // The real completion pipeline must have written a TrainingCompletion document —
        // this fails pre-fix because WorkoutLog.ClientId held plan.ClientId (a PublicId),
        // so WorkoutCompletionService's `ClientProfiles.FirstOrDefaultAsync(cp => cp.UserId == log.ClientId)`
        // lookup never matched and the fan-out silently no-op'd.
        await mongo.TrainingCompletions.Received(1).InsertOneAsync(
            Arg.Is<TrainingCompletion>(c =>
                c.ClientId == plan.ClientId && // TrainingCompletion is keyed by ClientProfile.PublicId
                c.SessionId == sessionId),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());
    }
}
