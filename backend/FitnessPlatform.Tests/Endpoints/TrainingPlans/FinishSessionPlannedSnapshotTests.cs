using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Features.TrainingPlans.FinishSession;
using FitnessPlatform.Application.Infrastructure.Data;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FitnessPlatform.Tests.Builders;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.TrainingPlans;

/// <summary>
/// Tests for the snapshot-planned-equals-actual behaviour in
/// <see cref="FinishSessionEndpoint"/>.MaterializeFromTemplate.
/// When a trainer retroactively finishes a session the execution is built from
/// the prescription: each set's planned values must equal its actual values
/// so that IsModified == false (done-as-prescribed).
/// #841: the endpoint now materializes a <see cref="SessionExecution"/> instead of the
/// retired <c>WorkoutLog</c>.
/// </summary>
public class FinishSessionPlannedSnapshotTests
{
    private readonly Guid _trainerId = Guid.NewGuid();

    private IWorkoutCompletionService StubCompletionService()
    {
        var svc = Substitute.For<IWorkoutCompletionService>();
        svc.CompleteAsync(Arg.Any<SessionExecution>(), Arg.Any<DateTime>(), Arg.Any<TimeZoneInfo>(), Arg.Any<CancellationToken>())
            .Returns(new List<string>());
        return svc;
    }

    /// <summary>
    /// FinishSessionEndpoint takes IApplicationDbContext since #935 to resolve the client's
    /// persisted time zone. No ApplicationUser row is seeded, so resolution falls back to UTC.
    /// </summary>
    private static IApplicationDbContext CreateMockDb() => new MockDbBuilder().Build();

    private static TrainingPlan CreatePlanWithPrescribedSets(Guid trainerId, Guid sessionId)
    {
        var sectionId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();

        return new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = Guid.NewGuid(),
            TrainerId = trainerId,
            Name = "Test Plan",
            Status = TrainingPlanStatus.Active,
            StartDate = DateTime.UtcNow.Date.AddDays(-30),
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    Days = TrainingPlanTestHelpers.MaterializeDays((1, new TrainingSession
                    {
                        SessionId = sessionId,
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
                                        ExerciseExternalId = exerciseId,
                                        ExerciseName = "Bench Press",
                                        Order = 1,
                                        Sets =
                                        [
                                            new ExerciseSet { SetNumber = 1, Reps = 10, WeightKg = 100m, Rpe = 7m },
                                            new ExerciseSet { SetNumber = 2, Reps = 10, WeightKg = 100m, Rpe = 8m },
                                            new ExerciseSet { SetNumber = 3, Reps = 8,  WeightKg = 100m }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }))
                }
            ],
            Version = 1,
            DateCreated = DateTime.UtcNow.AddDays(-30)
        };
    }

    private static (IMongoContext Mongo, IMongoCollection<SessionExecution> ExecutionCollection) CreateMockMongoWithInsert(
        TrainingPlan plan,
        IReadOnlyList<SessionExecution> existingExecutions)
    {
        var mongo = Substitute.For<IMongoContext>();

        var planCollection = TrainingPlanTestHelpers.CreateMockCollection([plan]);
        mongo.TrainingPlans.Returns(planCollection);

        var executionCollection = TrainingPlanTestHelpers.CreateMockSessionExecutionCollection(existingExecutions.ToList());
        mongo.SessionExecutions.Returns(executionCollection);

        return (mongo, executionCollection);
    }

    // ── MaterializeFromTemplate: planned == actual for every set ──────────────

    [Fact]
    public async Task MaterializeFromTemplate_InsertedLog_HasPlannedEqualsActualOnEachSet()
    {
        var sessionId = Guid.NewGuid();
        var plan = CreatePlanWithPrescribedSets(_trainerId, sessionId);
        var (mongo, executionCollection) = CreateMockMongoWithInsert(plan, []);
        var completionService = StubCompletionService();

        SessionExecution? insertedExecution = null;
        await executionCollection.InsertOneAsync(
            Arg.Do<SessionExecution>(l => insertedExecution = l),
            Arg.Any<InsertOneOptions>(),
            Arg.Any<CancellationToken>());

        var ep = Factory.Create<FinishSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, completionService,
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService(), CreateMockDb());

        await ep.HandleAsync(
            new FinishSessionRequest { PlanId = plan.ExternalId, SessionId = sessionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // Re-fetch the execution that was inserted (NSubstitute captured it above).
        // Because NSubstitute Arg.Do fires when the method is called but we set
        // up the capture after .Returns(), we verify via the completion-service call.
        await completionService.Received(1).CompleteAsync(
            Arg.Is<SessionExecution>(l =>
                // Every set must have planned == actual and IsModified == false.
                l.Exercises.All(ex =>
                    ex.Sets.All(s =>
                        s.PlannedReps == s.Reps &&
                        s.PlannedWeightKg == s.WeightKg &&
                        s.PlannedRpe == s.Rpe &&
                        s.PlannedDurationSeconds == s.DurationSeconds &&
                        s.PlannedDistanceMeters == s.DistanceMeters &&
                        !s.IsModified))),
            Arg.Any<DateTime>(),
            Arg.Any<TimeZoneInfo>(),
            Arg.Any<CancellationToken>());
    }

    // ── Specific values snapshot correctly ────────────────────────────────────

    [Fact]
    public async Task MaterializeFromTemplate_SetsSnapshotFromPrescribedValues()
    {
        var sessionId = Guid.NewGuid();
        var plan = CreatePlanWithPrescribedSets(_trainerId, sessionId);
        var (mongo, _) = CreateMockMongoWithInsert(plan, []);
        var completionService = StubCompletionService();

        var ep = Factory.Create<FinishSessionEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(
                    EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, completionService,
            EndpointTestHelpers.CreateGrantingLinkAuthorizationService(), CreateMockDb());

        await ep.HandleAsync(
            new FinishSessionRequest { PlanId = plan.ExternalId, SessionId = sessionId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        // Verify the first set of the materialized execution has Rpe snapshot set.
        // (PlannedRpe = 7m for set 1 as prescribed; set 3 has no Rpe → PlannedRpe null)
        await completionService.Received(1).CompleteAsync(
            Arg.Is<SessionExecution>(l =>
                l.Exercises[0].Sets[0].PlannedRpe == 7m &&
                l.Exercises[0].Sets[0].PlannedReps == 10 &&
                l.Exercises[0].Sets[0].PlannedWeightKg == 100m &&
                l.Exercises[0].Sets[2].PlannedRpe == null),  // set 3 has no Rpe in prescription
            Arg.Any<DateTime>(),
            Arg.Any<TimeZoneInfo>(),
            Arg.Any<CancellationToken>());
    }
}
