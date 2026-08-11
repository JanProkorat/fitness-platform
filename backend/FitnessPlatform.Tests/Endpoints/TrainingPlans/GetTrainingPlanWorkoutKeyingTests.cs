using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.TrainingPlans.GetTrainingPlan;
using FitnessPlatform.Tests.Builders;
using FitnessPlatform.Tests.Endpoints;

namespace FitnessPlatform.Tests.Endpoints.TrainingPlans;

/// <summary>
/// Tests for section-aware execution data in <see cref="GetTrainingPlanEndpoint"/>.
///
/// Covers issues #469 and #470 on the READ side:
/// — #470 READ: same exercise in two plan sections — each section's execution data
///   is independently addressable via <c>LoggedSetsByWorkoutAndExercise</c>.
/// — #469 READ: all exercises in a multi-exercise section are present in the map.
/// — Legacy: a log without SectionId (schema-on-read backfill) still renders correctly.
/// — Historical collapsed log (multi-section log that was collapsed) renders gracefully.
/// </summary>
public class GetTrainingPlanSectionKeyingTests
{
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly Guid _planId = Guid.NewGuid();
    private readonly Guid _sessionId = Guid.NewGuid();
    private readonly DateTime _now = DateTime.UtcNow;

    private TrainingPlan BuildPlanWithTwoSections(
        Guid standardSectionId,
        Guid amrapSectionId,
        Guid exerciseId)
    {
        var session = new TrainingSession
        {
            SessionId = _sessionId,
            Name = "Session 1",
            Workouts =
            [
                new TrainingWorkout
                {
                    WorkoutId = standardSectionId,
                    Name = "Hlavní",
                    Order = 0,
                    Exercises =
                    [
                        new SessionExercise
                        {
                            ExerciseExternalId = exerciseId,
                            ExerciseName = "Squat",
                            Order = 0,
                            Sets = [new ExerciseSet { SetNumber = 1, Reps = 5, WeightKg = 100m }]
                        }
                    ]
                },
                new TrainingWorkout
                {
                    WorkoutId = amrapSectionId,
                    Name = "AMRAP",
                    Order = 1,
                    Exercises =
                    [
                        new SessionExercise
                        {
                            ExerciseExternalId = exerciseId,
                            ExerciseName = "Squat",
                            Order = 0,
                            Sets = [new ExerciseSet { SetNumber = 1, Reps = 3, WeightKg = 60m }]
                        }
                    ]
                }
            ]
        };

        return new TrainingPlan
        {
            ExternalId = _planId,
            ClientId = _clientId,
            TrainerId = _trainerId,
            Name = "Test Plan",
            Status = TrainingPlanStatus.Active,
            Weeks =
            [
                new TrainingWeek
                {
                    WeekNumber = 1,
                    Status = WeekStatus.Published,
                    Days = TrainingPlanTestHelpers.MaterializeDays((1, session))
                }
            ],
            Version = 1,
            DateCreated = _now
        };
    }

    private WorkoutLog BuildTwoSectionLog(
        Guid standardSectionId,
        Guid amrapSectionId,
        Guid exerciseId,
        decimal standardWeight,
        decimal amrapWeight)
    {
        return new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            PlanId = _planId,
            SessionId = _sessionId,
            StartedAt = _now.AddMinutes(-30),
            IsCompleted = true,
            CompletedAt = _now,
            Workouts =
            [
                new LoggedWorkout
                {
                    WorkoutId = standardSectionId,
                    Order = 0,
                    Name = "Hlavní",
                    Exercises =
                    [
                        new WorkoutExercise
                        {
                            ExerciseExternalId = exerciseId,
                            ExerciseName = "Squat",
                            Sets =
                            [
                                new WorkoutSet
                                {
                                    SetNumber = 1,
                                    Reps = 5,
                                    WeightKg = standardWeight,
                                    PlannedReps = 5,
                                    PlannedWeightKg = 100m,
                                    CompletedAt = _now.AddMinutes(-20)
                                }
                            ]
                        }
                    ]
                },
                new LoggedWorkout
                {
                    WorkoutId = amrapSectionId,
                    Order = 1,
                    Name = "AMRAP",
                    Exercises =
                    [
                        new WorkoutExercise
                        {
                            ExerciseExternalId = exerciseId,
                            ExerciseName = "Squat",
                            Sets =
                            [
                                new WorkoutSet
                                {
                                    SetNumber = 1,
                                    Reps = 3,
                                    WeightKg = amrapWeight,
                                    PlannedReps = 3,
                                    PlannedWeightKg = 60m,
                                    CompletedAt = _now.AddMinutes(-10)
                                }
                            ]
                        }
                    ]
                }
            ],
            DateCreated = _now
        };
    }

    private async Task<GetTrainingPlanResponse?> ExecuteAsync(
        TrainingPlan plan,
        WorkoutLog[] logs)
    {
        var mongo = TrainingPlanTestHelpers.CreateMockMongoWithLogs(
            plans: [plan],
            workoutLogs: logs);

        var ep = Factory.Create<GetTrainingPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo,
            TrainingPlanTestHelpers.CreateNoOpLockService(),
            new MockDbBuilder().Build(),
            EndpointTestHelpers.CreateGrantingAuthHelper());

        await ep.HandleAsync(
            new GetTrainingPlanRequest { PlanId = _planId },
            TestContext.Current.CancellationToken);

        if (ep.HttpContext.Response.StatusCode != 200)
            return null;

        return ep.Response;
    }

    // ── #470 READ: same exercise in two sections — section-aware maps are independent ──

    /// <summary>
    /// A workout log has the same exercise in two sections with different actual weights.
    /// The section-aware maps must address them independently so the web layer can
    /// render the correct actual-vs-planned for each section.
    /// </summary>
    [Fact]
    public async Task SessionExecution_SameExerciseTwoSections_SectionAwareMapsHaveIndependentEntries()
    {
        var standardSectionId = Guid.NewGuid();
        var amrapSectionId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();

        var plan = BuildPlanWithTwoSections(standardSectionId, amrapSectionId, exerciseId);
        // Standard section: 100 kg (as planned); AMRAP section: 60 kg (as planned)
        var log = BuildTwoSectionLog(standardSectionId, amrapSectionId, exerciseId,
            standardWeight: 100m, amrapWeight: 60m);

        var response = await ExecuteAsync(plan, [log]);

        response.Should().NotBeNull();
        response!.SessionExecutions.Should().HaveCount(1);
        var exec = response.SessionExecutions.Single();

        var standardKey = $"{standardSectionId}:{exerciseId}";
        var amrapKey = $"{amrapSectionId}:{exerciseId}";

        // Section-aware maps must have independent entries for each section.
        exec.LoggedSetsByWorkoutAndExercise.Should().ContainKey(standardKey);
        exec.LoggedSetsByWorkoutAndExercise.Should().ContainKey(amrapKey);

        exec.LoggedSetsByWorkoutAndExercise[standardKey].Single().ActualWeightKg.Should().Be(100m);
        exec.LoggedSetsByWorkoutAndExercise[amrapKey].Single().ActualWeightKg.Should().Be(60m);
    }

    /// <summary>
    /// Only the standard section has edits (IsModified); the AMRAP section was executed as planned.
    /// The section-aware completed-sets map must reflect each section independently.
    /// </summary>
    [Fact]
    public async Task SessionExecution_EditsOnlyInStandardSection_AmrapSectionShowsPlannedOnly()
    {
        var standardSectionId = Guid.NewGuid();
        var amrapSectionId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();

        var plan = BuildPlanWithTwoSections(standardSectionId, amrapSectionId, exerciseId);
        // Standard: heavier than planned (IsModified=true); AMRAP: as planned (IsModified=false)
        var log = BuildTwoSectionLog(standardSectionId, amrapSectionId, exerciseId,
            standardWeight: 120m,   // diverges from PlannedWeightKg=100
            amrapWeight: 60m);      // matches PlannedWeightKg=60

        var response = await ExecuteAsync(plan, [log]);

        response.Should().NotBeNull();
        var exec = response!.SessionExecutions.Single();

        var standardKey = $"{standardSectionId}:{exerciseId}";
        var amrapKey = $"{amrapSectionId}:{exerciseId}";

        exec.LoggedSetsByWorkoutAndExercise[standardKey].Single().IsModified.Should().BeTrue();
        exec.LoggedSetsByWorkoutAndExercise[amrapKey].Single().IsModified.Should().BeFalse();

        // HasModifications is true because at least one set (in standard) is modified.
        exec.HasModifications.Should().BeTrue();
    }

    // ── #469 READ: all exercises in a section appear in the map ──────────────────

    /// <summary>
    /// A session has one section with three different exercises. After a workout log is
    /// submitted, the section-aware map must contain all three exercises.
    /// </summary>
    [Fact]
    public async Task SessionExecution_ThreeExercisesInSection_AllPresentInSectionAwareMap()
    {
        var sectionId = Guid.NewGuid();
        var exA = Guid.NewGuid();
        var exB = Guid.NewGuid();
        var exC = Guid.NewGuid();

        var session = new TrainingSession
        {
            SessionId = _sessionId,
            Name = "Session 1",
            Workouts =
            [
                new TrainingWorkout
                {
                    WorkoutId = sectionId,
                    Name = "Hlavní",
                    Order = 0,
                    Exercises =
                    [
                        new SessionExercise { ExerciseExternalId = exA, ExerciseName = "Squat", Order = 0, Sets = [new ExerciseSet { SetNumber = 1 }] },
                        new SessionExercise { ExerciseExternalId = exB, ExerciseName = "Press",  Order = 1, Sets = [new ExerciseSet { SetNumber = 1 }] },
                        new SessionExercise { ExerciseExternalId = exC, ExerciseName = "Pull",   Order = 2, Sets = [new ExerciseSet { SetNumber = 1 }] }
                    ]
                }
            ]
        };

        var plan = new TrainingPlan
        {
            ExternalId = _planId,
            ClientId = _clientId,
            TrainerId = _trainerId,
            Name = "Test Plan",
            Status = TrainingPlanStatus.Active,
            Weeks = [new TrainingWeek { WeekNumber = 1, Status = WeekStatus.Published, Days = TrainingPlanTestHelpers.MaterializeDays((1, session)) }],
            Version = 1,
            DateCreated = _now
        };

        var log = new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            PlanId = _planId,
            SessionId = _sessionId,
            StartedAt = _now.AddMinutes(-30),
            IsCompleted = true,
            CompletedAt = _now,
            Workouts =
            [
                new LoggedWorkout
                {
                    WorkoutId = sectionId,
                    Order = 0,
                    Name = "Hlavní",
                    Exercises =
                    [
                        new WorkoutExercise { ExerciseExternalId = exA, ExerciseName = "Squat", Sets = [new WorkoutSet { SetNumber = 1, Reps = 10, WeightKg = 100m, PlannedReps = 10, PlannedWeightKg = 100m, CompletedAt = _now.AddMinutes(-25) }] },
                        new WorkoutExercise { ExerciseExternalId = exB, ExerciseName = "Press",  Sets = [new WorkoutSet { SetNumber = 1, Reps = 8,  WeightKg = 80m,  PlannedReps = 8,  PlannedWeightKg = 80m,  CompletedAt = _now.AddMinutes(-20) }] },
                        new WorkoutExercise { ExerciseExternalId = exC, ExerciseName = "Pull",   Sets = [new WorkoutSet { SetNumber = 1, Reps = 12, WeightKg = 60m,  PlannedReps = 10, PlannedWeightKg = 60m,  CompletedAt = _now.AddMinutes(-15) }] }
                    ]
                }
            ],
            DateCreated = _now
        };

        var response = await ExecuteAsync(plan, [log]);

        response.Should().NotBeNull();
        var exec = response!.SessionExecutions.Single();

        // All three exercises must appear in the section-aware map.
        exec.LoggedSetsByWorkoutAndExercise.Should().ContainKey($"{sectionId}:{exA}");
        exec.LoggedSetsByWorkoutAndExercise.Should().ContainKey($"{sectionId}:{exB}");
        exec.LoggedSetsByWorkoutAndExercise.Should().ContainKey($"{sectionId}:{exC}");

        // Verify actual values are correct per exercise.
        exec.LoggedSetsByWorkoutAndExercise[$"{sectionId}:{exA}"].Single().ActualWeightKg.Should().Be(100m);
        exec.LoggedSetsByWorkoutAndExercise[$"{sectionId}:{exB}"].Single().ActualWeightKg.Should().Be(80m);
        exec.LoggedSetsByWorkoutAndExercise[$"{sectionId}:{exC}"].Single().ActualWeightKg.Should().Be(60m);

        // Exercise C has more reps than planned — IsModified must be true.
        exec.LoggedSetsByWorkoutAndExercise[$"{sectionId}:{exC}"].Single().IsModified.Should().BeTrue();
        exec.HasModifications.Should().BeTrue();
    }

    // ── Legacy log schema-on-read is retired (#837) ──────────────────────────────
    //
    // The flat-`exercises`-no-sections scenario previously covered here
    // (WithBackfilledSections() at read time) is retired: a log at this layer is
    // always sections/workouts-populated. (#857 subsequently deleted the boot-time
    // backfill that used to synthesize the modern shape from legacy flat `exercises`
    // logs — see MongoIndexInitializer and its TrainingTreeRestructureMigrationTests
    // absence-test coverage — legacy documents are simply left untouched now, not
    // migrated on read.)

    // ── Graceful degradation: already-collapsed historical log ───────────────────

    /// <summary>
    /// A historical multi-section log that was already collapsed into one section
    /// by the old write path renders without error. The single collapsed section
    /// appears in the section-aware map.
    /// </summary>
    [Fact]
    public async Task SessionExecution_AlreadyCollapsedHistoricalLog_RendersWithoutError()
    {
        var exerciseId = Guid.NewGuid();
        var sectionId = Guid.NewGuid();    // only one section — collapsed

        var planSectionA = Guid.NewGuid();
        var session = new TrainingSession
        {
            SessionId = _sessionId,
            Name = "Session 1",
            Workouts =
            [
                new TrainingWorkout
                {
                    WorkoutId = planSectionA,
                    Name = "Hlavní",
                    Order = 0,
                    Exercises = [new SessionExercise { ExerciseExternalId = exerciseId, ExerciseName = "Squat", Order = 0, Sets = [new ExerciseSet { SetNumber = 1 }] }]
                }
            ]
        };

        var plan = new TrainingPlan
        {
            ExternalId = _planId,
            ClientId = _clientId,
            TrainerId = _trainerId,
            Name = "Test Plan",
            Status = TrainingPlanStatus.Active,
            Weeks = [new TrainingWeek { WeekNumber = 1, Status = WeekStatus.Published, Days = TrainingPlanTestHelpers.MaterializeDays((1, session)) }],
            Version = 1,
            DateCreated = _now
        };

        // Collapsed historical log: only one section even though the workout had two.
        var collapsedLog = new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            PlanId = _planId,
            SessionId = _sessionId,
            StartedAt = _now.AddMinutes(-30),
            IsCompleted = true,
            CompletedAt = _now,
            Workouts =
            [
                new LoggedWorkout
                {
                    WorkoutId = sectionId,
                    Order = 0,
                    Name = "Hlavní",
                    Exercises =
                    [
                        new WorkoutExercise
                        {
                            ExerciseExternalId = exerciseId,
                            ExerciseName = "Squat",
                            Sets = [new WorkoutSet { SetNumber = 1, Reps = 5, WeightKg = 100m, CompletedAt = _now.AddMinutes(-20) }]
                        }
                    ]
                }
            ],
            DateCreated = _now
        };

        // Must not throw — historical logs render gracefully even if section boundaries
        // cannot be recovered.
        var act = async () => await ExecuteAsync(plan, [collapsedLog]);
        await act.Should().NotThrowAsync();

        var response = await ExecuteAsync(plan, [collapsedLog]);
        response.Should().NotBeNull();

        var exec = response!.SessionExecutions.Single();
        exec.LoggedSetsByWorkoutAndExercise.Should().HaveCount(1);
        exec.LoggedSetsByWorkoutAndExercise.Values.Single().Single().ActualWeightKg.Should().Be(100m);
    }
}
