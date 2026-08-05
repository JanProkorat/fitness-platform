using System.Security.Claims;
using FastEndpoints;
using FastEndpoints.Testing;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Interfaces;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Features.SessionTemplates.Shared;
using FitnessPlatform.Application.Features.TrainingPlans.UpdateTrainingPlan;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints.TrainingPlans;
using FluentAssertions;
using MongoDB.Driver;
using NSubstitute;

namespace FitnessPlatform.Tests.Endpoints.SessionTemplates;

/// <summary>
/// Pins the round-trip AC: a <see cref="SessionTemplate"/> fetched via GET can be embedded into a
/// plan through the existing <see cref="UpdateTrainingPlanEndpoint"/> with no change to that
/// endpoint. The template's <see cref="SessionTemplateDetailResponse.Workouts"/> map to
/// <see cref="UpdateSessionRequest.Workouts"/> and <see cref="SessionTemplateDetailResponse.StandaloneExercises"/>
/// map to <see cref="UpdateSessionRequest.StandaloneExercises"/> — <see cref="SessionTemplateDetailResponse.AllExercises"/>
/// is NEVER sent on write. Uses order values legal on BOTH the template validator's rules and
/// <c>UpdateTrainingPlanValidator</c>'s rules (workout Order 0-based, exercise Order >= 1, one
/// combined-distinct sequence) — otherwise a template could validate template-side and then 400
/// on the plan write, silently defeating this AC.
/// </summary>
public class SessionTemplateRoundTripTests
{
    private readonly Guid _trainerId = Guid.NewGuid();

    private static ISessionLockService StubLockService()
    {
        var svc = Substitute.For<ISessionLockService>();
        svc.GetStateAsync(Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(Array.Empty<SessionLock>());
        return svc;
    }

    /// <summary>
    /// Builds a <see cref="SessionTemplate"/> containing BOTH a workout with two nested exercises
    /// and one standalone exercise, all sharing one legal ordering sequence.
    /// </summary>
    private static SessionTemplate MakeTemplate(Guid ownerId)
    {
        var workout = new TrainingWorkout
        {
            WorkoutId = Guid.NewGuid(),
            Order = 0, // 0-based, legal on both the template validator and UpdateTrainingPlanValidator
            Name = "Main",
            Exercises =
            [
                new SessionExercise
                {
                    ExerciseExternalId = Guid.NewGuid(),
                    ExerciseName = "Back Squat",
                    Order = 1,
                    Sets = [new ExerciseSet { SetNumber = 1, Type = SetType.Normal, Reps = 5, WeightKg = 60 }]
                },
                new SessionExercise
                {
                    ExerciseExternalId = Guid.NewGuid(),
                    ExerciseName = "Leg Press",
                    Order = 2,
                    Sets = [new ExerciseSet { SetNumber = 1, Type = SetType.Normal, Reps = 10, WeightKg = 120 }]
                }
            ]
        };

        var standaloneExercise = new SessionExercise
        {
            ExerciseExternalId = Guid.NewGuid(),
            ExerciseName = "Plank",
            Order = 1, // legal: shares the ordering sequence with Workouts (0), no collision
            Sets = [new ExerciseSet { SetNumber = 1, Type = SetType.Normal, DurationSeconds = 60 }]
        };

        return new SessionTemplate
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = ownerId,
            Name = "Full Body",
            Difficulty = ExerciseDifficulty.Intermediate,
            Workouts = [workout],
            StandaloneExercises = [standaloneExercise],
            Visibility = LibraryVisibility.Private,
            DateCreated = DateTime.UtcNow,
            Version = 1
        };
    }

    /// <summary>
    /// The mapping a real client (web/mobile) performs after a GET: the response's
    /// <see cref="TrainingWorkout"/>/<see cref="SessionExercise"/> shapes map field-for-field onto
    /// <see cref="UpdateTrainingWorkoutRequest"/>/<see cref="UpdateSessionExerciseRequest"/>.
    /// </summary>
    private static UpdateSessionRequest MapToUpdateSessionRequest(SessionTemplateDetailResponse template) => new()
    {
        SessionId = Guid.NewGuid(),
        DayOfWeek = 1,
        Name = template.Name,
        Order = 1,
        Format = null,
        Workouts = template.Workouts.Select(w => new UpdateTrainingWorkoutRequest
        {
            WorkoutId = w.WorkoutId,
            Order = w.Order,
            Name = w.Name,
            Format = w.Format,
            FormatConfig = w.FormatConfig,
            Notes = w.Notes,
            Exercises = w.Exercises.Select(MapExercise).ToList()
        }).ToList(),
        StandaloneExercises = template.StandaloneExercises.Select(MapExercise).ToList()
    };

    private static UpdateSessionExerciseRequest MapExercise(SessionExercise e) => new()
    {
        ExerciseId = e.ExerciseId,
        ExerciseExternalId = e.ExerciseExternalId,
        ExerciseName = e.ExerciseName,
        Order = e.Order,
        Notes = e.Notes,
        RestSeconds = e.RestSeconds,
        MovementType = e.MovementType,
        Format = e.Format,
        FormatConfig = e.FormatConfig,
        Sets = e.Sets.Select(s => new UpdateExerciseSetRequest
        {
            SetNumber = s.SetNumber,
            Type = s.Type,
            Reps = s.Reps,
            WeightKg = s.WeightKg,
            DurationSeconds = s.DurationSeconds,
            Rpe = s.Rpe,
            DistanceMeters = s.DistanceMeters,
            RestSeconds = s.RestSeconds
        }).ToList()
    };

    [Fact]
    public async Task SessionTemplate_EmbeddedIntoPlan_RoundTripsStandaloneAndWorkoutExerciseCountsSeparately()
    {
        var template = MakeTemplate(_trainerId);
        var response = SessionTemplateDetailResponse.FromDocument(template, _trainerId);

        // AllExercises is the computed, read-only flat view — assert it is never what gets sent.
        response.AllExercises.Should().HaveCount(3); // 1 standalone + 2 nested

        var planId = Guid.NewGuid();
        var plan = TrainingPlanTestHelpers.CreatePlan(externalId: planId, trainerId: _trainerId, weekCount: 1);
        var mongo = TrainingPlanTestHelpers.CreateMockMongo(plan);

        var ep = Factory.Create<UpdateTrainingPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo, StubLockService(), Substitute.For<IRealtimeNotifier>(), new PlanConcurrencyGuard(),
            new MockDbBuilder().Build());

        var sessionRequest = MapToUpdateSessionRequest(response);

        var request = new UpdateTrainingPlanRequest
        {
            PlanId = planId,
            Name = "Plan From Template",
            Version = 1,
            Weeks = [new UpdateTrainingWeekRequest { WeekNumber = 1, Sessions = [sessionRequest] }]
        };

        // Arg.Do only fires when configured as part of the call's stub setup (BEFORE the real
        // call happens) — configuring it inside a post-hoc Received() check does not retroactively
        // invoke it. Re-stub ReplaceOneAsync here, ahead of HandleAsync, to capture what gets
        // persisted while still returning the ModifiedCount=1 result the endpoint expects.
        TrainingPlan? persisted = null;
        var replaceResult = Substitute.For<ReplaceOneResult>();
        replaceResult.ModifiedCount.Returns(1L);
        mongo.TrainingPlans.ReplaceOneAsync(
                Arg.Any<FilterDefinition<TrainingPlan>>(),
                Arg.Do<TrainingPlan>(p => persisted = p),
                Arg.Any<ReplaceOptions>(),
                Arg.Any<CancellationToken>())
            .Returns(replaceResult);

        await ep.HandleAsync(request, TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(200);

        persisted.Should().NotBeNull();
        var session = persisted!.Weeks
            .SelectMany(w => w.Days)
            .SelectMany(d => d.Sessions)
            .Single();

        // Standalone-exercise count and each workout's nested-exercise count are asserted
        // SEPARATELY, per collection — not only as a combined total, per the design review's
        // explicit AC wording. Never compounded: a bug that sent AllExercises as
        // StandaloneExercises would produce a standalone count of 3 (1 + 2 nested), not 1.
        session.StandaloneExercises.Should().HaveCount(1);
        session.StandaloneExercises.Select(e => e.ExerciseName).Should().Equal("Plank");

        session.Workouts.Should().HaveCount(1);
        session.Workouts[0].Exercises.Should().HaveCount(2);
        session.Workouts[0].Exercises.Select(e => e.ExerciseName).Should().Equal("Back Squat", "Leg Press");
    }
}
