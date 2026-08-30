using System.Security.Claims;
using FastEndpoints;
using FastEndpoints.Testing;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.TrainingPlans.UpdateTrainingPlan;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.TrainingPlans;

/// <summary>
/// Tests for <see cref="UpdateTrainingPlanEndpoint"/>.
/// </summary>
public class UpdateTrainingPlanEndpointTests
{
    private readonly Guid _trainerId = Guid.NewGuid();

    private static ISessionLockService StubLockService()
    {
        var svc = Substitute.For<ISessionLockService>();
        svc.GetStateAsync(Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(Array.Empty<SessionLock>());
        svc.ReleaseAsync(Arg.Any<Guid>(), Arg.Any<LockHolder>(), Arg.Any<LockType>(),
            Arg.Any<CancellationToken>()).Returns(false);
        return svc;
    }

    private UpdateTrainingPlanEndpoint CreateEndpoint(IMongoContext mongo) =>
        Factory.Create<UpdateTrainingPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, StubLockService(), Substitute.For<IRealtimeNotifier>(), new PlanConcurrencyGuard(),
            new MockDbBuilder().Build(),
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

    [Fact]
    public async Task HandleAsync_ValidUpdate_Returns200()
    {
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(
            externalId: planId, trainerId: _trainerId, weekCount: 2);
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);

        var ep = Factory.Create<UpdateTrainingPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, StubLockService(), Substitute.For<IRealtimeNotifier>(), new PlanConcurrencyGuard(),
            new MockDbBuilder().Build(),
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

        var request = new UpdateTrainingPlanRequest
        {
            PlanId = planId,
            Name = "Updated Plan",
            Version = 1,
            Weeks =
            [
                new UpdateTrainingWeekRequest { WeekNumber = 1, Sessions = [] },
                new UpdateTrainingWeekRequest { WeekNumber = 2, Sessions = [] }
            ]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);
    }

    /// <summary>
    /// Deny-path test for the link-authorization guard itself (not authorship). The plan is
    /// owned by the caller, but the caller's link to the plan's client no longer grants training
    /// access — this must still 404. If <see cref="IClientLinkAuthorizationService"/> were
    /// removed from this guard, this test would regress to 200.
    /// </summary>
    [Fact]
    public async Task HandleAsync_NotLinkedToClient_Returns404()
    {
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(
            externalId: planId, trainerId: _trainerId, weekCount: 2);
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);

        var ep = Factory.Create<UpdateTrainingPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, StubLockService(), Substitute.For<IRealtimeNotifier>(), new PlanConcurrencyGuard(),
            new MockDbBuilder().Build(),
            TrainingPlanTestHelpers.CreateDenyingLinkAuthorizationService());

        var request = new UpdateTrainingPlanRequest
        {
            PlanId = planId,
            Name = "Updated Plan",
            Version = 1,
            Weeks =
            [
                new UpdateTrainingWeekRequest { WeekNumber = 1, Sessions = [] },
                new UpdateTrainingWeekRequest { WeekNumber = 2, Sessions = [] }
            ]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);

        await mongo.TrainingPlans.DidNotReceive().ReplaceOneAsync(
            Arg.Any<FilterDefinition<TrainingPlan>>(),
            Arg.Any<TrainingPlan>(),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    /// <summary>
    /// Flag-inversion deny test: the link is active and exists, but grants only the nutrition
    /// domain. A "no link" deny test cannot detect a guard that checks the wrong flag, since
    /// both flags are absent either way — this pins the guard to
    /// <c>CanViewTrainingPlans</c> specifically.
    /// </summary>
    [Fact]
    public async Task HandleAsync_LinkGrantsOnlyNutrition_Returns404()
    {
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(
            externalId: planId, trainerId: _trainerId, weekCount: 2);
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);

        var ep = Factory.Create<UpdateTrainingPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, StubLockService(), Substitute.For<IRealtimeNotifier>(), new PlanConcurrencyGuard(),
            new MockDbBuilder().Build(),
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService(
                canViewNutritionPlans: true, canViewTrainingPlans: false));

        var request = new UpdateTrainingPlanRequest
        {
            PlanId = planId,
            Name = "Updated Plan",
            Version = 1,
            Weeks =
            [
                new UpdateTrainingWeekRequest { WeekNumber = 1, Sessions = [] },
                new UpdateTrainingWeekRequest { WeekNumber = 2, Sessions = [] }
            ]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);

        await mongo.TrainingPlans.DidNotReceive().ReplaceOneAsync(
            Arg.Any<FilterDefinition<TrainingPlan>>(),
            Arg.Any<TrainingPlan>(),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_AllZeroIds_MintsFreshIdsInsteadOfPersistingEmptyGuids()
    {
        // Root cause (#857 finding 3): `ExerciseId = re.ExerciseId ?? Guid.NewGuid()` (and the
        // equivalent for SessionId/WorkoutId) only guards the null case. A request carrying the
        // literal all-zero Guid "00000000-0000-0000-0000-000000000000" deserializes to a non-null
        // Guid.Empty, which null-coalescing lets through unchanged — exactly the shape a template
        // (or a template-instantiated plan, #862) serves. A persisted Guid.Empty id becomes
        // permanently unreachable via MarkExerciseComplete (NotEmpty validator on ExerciseId).
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(
            externalId: planId, trainerId: _trainerId, weekCount: 1);
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);
        var ep = CreateEndpoint(mongo);

        var request = new UpdateTrainingPlanRequest
        {
            PlanId = planId,
            Name = "Plan From Template",
            Version = 1,
            Weeks =
            [
                new UpdateTrainingWeekRequest
                {
                    WeekNumber = 1,
                    Sessions =
                    [
                        new UpdateSessionRequest
                        {
                            SessionId = Guid.Empty,
                            DayOfWeek = 1,
                            Name = "Push Day",
                            Order = 1,
                            Workouts =
                            [
                                new UpdateTrainingWorkoutRequest
                                {
                                    WorkoutId = Guid.Empty,
                                    Order = 1,
                                    Name = "Main",
                                    Exercises =
                                    [
                                        new UpdateSessionExerciseRequest
                                        {
                                            ExerciseId = Guid.Empty,
                                            ExerciseExternalId = Guid.NewGuid(),
                                            ExerciseName = "Bench Press",
                                            Order = 1
                                        }
                                    ]
                                }
                            ],
                            StandaloneExercises =
                            [
                                new UpdateSessionExerciseRequest
                                {
                                    ExerciseId = Guid.Empty,
                                    ExerciseExternalId = Guid.NewGuid(),
                                    ExerciseName = "Plank",
                                    Order = 2
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        await mongo.TrainingPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<TrainingPlan>>(),
            Arg.Is<TrainingPlan>(p =>
                p.Weeks.SelectMany(w => w.Days).SelectMany(d => d.Sessions).All(session =>
                    session.SessionId != Guid.Empty
                    && session.Workouts.All(workout =>
                        workout.WorkoutId != Guid.Empty
                        && workout.Exercises.All(ex => ex.ExerciseId != Guid.Empty))
                    && session.StandaloneExercises.All(ex => ex.ExerciseId != Guid.Empty))),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_VersionConflict_Returns409()
    {
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(
            externalId: planId, trainerId: _trainerId, version: 2);
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);

        var ep = Factory.Create<UpdateTrainingPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, StubLockService(), Substitute.For<IRealtimeNotifier>(), new PlanConcurrencyGuard(),
            new MockDbBuilder().Build(),
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService());

        var request = new UpdateTrainingPlanRequest
        {
            PlanId = planId,
            Name = "Updated",
            Version = 1,
            Weeks = [new UpdateTrainingWeekRequest { WeekNumber = 1, Sessions = [] }]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(409);
    }

    [Fact]
    public async Task HandleAsync_UnchangedPastStartDate_DoesNotReject()
    {
        // Arrange: plan already saved with a start date that is now in the past.
        var planId = Guid.NewGuid();
        var pastMonday = TrainingPlanTestHelpers.LastMonday();
        var plan = TrainingPlanTestHelpers.CreatePlan(
            externalId: planId, trainerId: _trainerId, weekCount: 1);
        plan.StartDate = DateTime.SpecifyKind(pastMonday, DateTimeKind.Utc);

        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);
        var ep = CreateEndpoint(mongo);

        // Act: PUT with the same StartDate, only changing the name.
        var request = new UpdateTrainingPlanRequest
        {
            PlanId = planId,
            Name = "Renamed In-Progress Plan",
            Version = 1,
            StartDate = pastMonday,
            Weeks = [new UpdateTrainingWeekRequest { WeekNumber = 1, Sessions = [] }]
        };

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        // Assert: should succeed — ReplaceOneAsync called, not rejected.
        await mongo.TrainingPlans.Received(1).ReplaceOneAsync(
            Arg.Any<FilterDefinition<TrainingPlan>>(),
            Arg.Is<TrainingPlan>(p => p.Name == "Renamed In-Progress Plan"),
            Arg.Any<ReplaceOptions>(),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task HandleAsync_NewPastStartDate_StillRejects()
    {
        // Arrange: plan with no start date yet.
        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(
            externalId: planId, trainerId: _trainerId, weekCount: 1);
        // StartDate is null — not yet set.

        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);
        var ep = CreateEndpoint(mongo);

        // Act: PUT setting StartDate to a past Monday for the first time.
        var request = new UpdateTrainingPlanRequest
        {
            PlanId = planId,
            Name = "Plan",
            Version = 1,
            StartDate = TrainingPlanTestHelpers.LastMonday(),
            Weeks = [new UpdateTrainingWeekRequest { WeekNumber = 1, Sessions = [] }]
        };

        var act = () => ep.HandleAsync(request, TestContext.Current.CancellationToken);

        // Assert: rejected — a past start date on a plan that never had one is blocked.
        await act.Should().ThrowAsync<ValidationFailureException>();
    }
}
