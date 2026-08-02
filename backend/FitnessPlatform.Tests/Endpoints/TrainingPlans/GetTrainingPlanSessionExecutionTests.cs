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
/// Tests for the <see cref="GetTrainingPlanEndpoint"/> <c>SessionExecutions</c> fold-in
/// introduced in #323. Verifies all four execution-state branches documented in the
/// design handoff:
/// <list type="bullet">
///   <item><description>(a) No WorkoutLog → empty SessionExecutions.</description></item>
///   <item><description>(b) WorkoutLog with IsCompleted=false → isSessionFinished=false.</description></item>
///   <item><description>(c) IsCompleted=true, all sets stamped → all appear in completedSetsByExercise.</description></item>
///   <item><description>(d) IsCompleted=true, some sets missing CompletedAt → partial (web derives skipped).</description></item>
/// </list>
/// Plus deduplication: multiple logs for the same session keep only the best one.
/// </summary>
public class GetTrainingPlanSessionExecutionTests
{
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly Guid _planId = Guid.NewGuid();
    private readonly Guid _sessionId = Guid.NewGuid();
    private readonly Guid _exerciseId = Guid.NewGuid();
    private readonly DateTime _now = DateTime.UtcNow;

    // ── Helper builders ───────────────────────────────────────────────────────

    private TrainingPlan BuildPlan()
    {
        var session = new TrainingSession
        {
            SessionId = _sessionId,
            Name = "Session 1",
            DayOfWeek = 1, // Monday
            Workouts =
            [
                new TrainingWorkout
                {
                    WorkoutId = Guid.NewGuid(),
                    Name = "Main",
                    Order = 0,
                    Exercises =
                    [
                        new SessionExercise
                        {
                            ExerciseExternalId = _exerciseId,
                            ExerciseName = "Squat",
                            Order = 0,
                            Sets =
                            [
                                new ExerciseSet { SetNumber = 1, Reps = 10 },
                                new ExerciseSet { SetNumber = 2, Reps = 10 },
                                new ExerciseSet { SetNumber = 3, Reps = 10 }
                            ]
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
                    Sessions = [session]
                }
            ],
            Version = 1,
            DateCreated = _now
        };
    }

    private WorkoutLog BuildLog(
        bool isCompleted,
        List<(int setNumber, DateTime? completedAt)> setStamps,
        DateTime? dateUpdated = null)
    {
        return new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = Guid.NewGuid(), // ApplicationUser.Id — irrelevant for the trainer endpoint
            PlanId = _planId,
            SessionId = _sessionId,
            StartedAt = _now.AddMinutes(-30),
            IsCompleted = isCompleted,
            CompletedAt = isCompleted ? _now : null,
            Sections =
            [
                new WorkoutSection
                {
                    SectionId = Guid.NewGuid(),
                    Order = 0,
                    Name = "Main",
                    Exercises =
                    [
                        new WorkoutExercise
                        {
                            ExerciseExternalId = _exerciseId,
                            ExerciseName = "Squat",
                            Sets = setStamps
                                .Select(s => new WorkoutSet
                                {
                                    SetNumber = s.setNumber,
                                    Reps = 10,
                                    CompletedAt = s.completedAt
                                })
                                .ToList()
                        }
                    ]
                }
            ],
            DateCreated = _now.AddMinutes(-35),
            DateUpdated = dateUpdated
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
            new MockDbBuilder().Build());

        await ep.HandleAsync(
            new GetTrainingPlanRequest { PlanId = _planId },
            TestContext.Current.CancellationToken);

        if (ep.HttpContext.Response.StatusCode != 200)
            return null;

        return ep.Response;
    }

    // ── Test cases ────────────────────────────────────────────────────────────

    /// <summary>
    /// (a) No WorkoutLog for the plan → SessionExecutions is an empty list.
    /// The web layer renders no completion badges (not-yet-reached on all sets).
    /// </summary>
    [Fact]
    public async Task SessionExecutions_NoWorkoutLog_IsEmptyList()
    {
        var plan = BuildPlan();
        var response = await ExecuteAsync(plan, []);

        response.Should().NotBeNull();
        response!.SessionExecutions.Should().BeEmpty();
    }

    /// <summary>
    /// (b) WorkoutLog present, IsCompleted=false (session still in progress).
    /// SessionExecutions has one entry with IsSessionFinished=false.
    /// Only sets with a non-null CompletedAt appear in CompletedSetsByExercise;
    /// unstamped sets are absent (treated as not-yet-reached by the web layer,
    /// since the session has not been finalised).
    /// </summary>
    [Fact]
    public async Task SessionExecutions_LogInProgress_IsSessionFinishedFalse()
    {
        var plan = BuildPlan();
        var log = BuildLog(
            isCompleted: false,
            setStamps:
            [
                (1, _now.AddMinutes(-20)), // set 1 completed mid-session
                (2, null),                 // set 2 not yet done
                (3, null)                  // set 3 not yet done
            ]);

        var response = await ExecuteAsync(plan, [log]);

        response.Should().NotBeNull();
        response!.SessionExecutions.Should().HaveCount(1);

        var exec = response.SessionExecutions.Single();
        exec.SessionId.Should().Be(_sessionId);
        exec.IsSessionFinished.Should().BeFalse();
        exec.CompletedSetsByExercise.Should().ContainKey(_exerciseId);
        exec.CompletedSetsByExercise[_exerciseId].Should().BeEquivalentTo(new[] { 1 });
    }

    /// <summary>
    /// (c) WorkoutLog present, IsCompleted=true, every set has CompletedAt stamped.
    /// All three sets appear in CompletedSetsByExercise.
    /// Web: Check + accent on each set; session badge "all complete".
    /// </summary>
    [Fact]
    public async Task SessionExecutions_AllSetsStamped_AllAppearInCompleted()
    {
        var plan = BuildPlan();
        var log = BuildLog(
            isCompleted: true,
            setStamps:
            [
                (1, _now.AddMinutes(-25)),
                (2, _now.AddMinutes(-20)),
                (3, _now.AddMinutes(-15))
            ]);

        var response = await ExecuteAsync(plan, [log]);

        response.Should().NotBeNull();
        response!.SessionExecutions.Should().HaveCount(1);

        var exec = response.SessionExecutions.Single();
        exec.SessionId.Should().Be(_sessionId);
        exec.IsSessionFinished.Should().BeTrue();
        exec.CompletedSetsByExercise.Should().ContainKey(_exerciseId);
        exec.CompletedSetsByExercise[_exerciseId].Should().BeEquivalentTo(new[] { 1, 2, 3 });
    }

    /// <summary>
    /// (d) WorkoutLog present, IsCompleted=true, set 3 lacks CompletedAt (was skipped).
    /// Only sets 1 and 2 appear in CompletedSetsByExercise.
    /// Web: sets 1+2 render Check; set 3 renders SkipForward (isSessionFinished=true,
    /// set 3 absent from list → derived as "skipped").
    /// </summary>
    [Fact]
    public async Task SessionExecutions_SomeSetsSkipped_OnlyStampedSetsInCompleted()
    {
        var plan = BuildPlan();
        var log = BuildLog(
            isCompleted: true,
            setStamps:
            [
                (1, _now.AddMinutes(-25)),
                (2, _now.AddMinutes(-20)),
                (3, null)  // set 3 skipped — no CompletedAt
            ]);

        var response = await ExecuteAsync(plan, [log]);

        response.Should().NotBeNull();
        response!.SessionExecutions.Should().HaveCount(1);

        var exec = response.SessionExecutions.Single();
        exec.SessionId.Should().Be(_sessionId);
        exec.IsSessionFinished.Should().BeTrue();
        exec.CompletedSetsByExercise.Should().ContainKey(_exerciseId);
        exec.CompletedSetsByExercise[_exerciseId].Should().BeEquivalentTo(new[] { 1, 2 });
        // Set 3 absent → web derives it as skipped (isSessionFinished=true + not in list)
        exec.CompletedSetsByExercise[_exerciseId].Should().NotContain(3);
    }

    /// <summary>
    /// Deduplication: two logs for the same session — one finalised, one in-progress.
    /// The endpoint must pick the most-recently-updated finalised log.
    /// This ensures a client who re-opened a session doesn't wipe the completion state.
    /// </summary>
    [Fact]
    public async Task SessionExecutions_DuplicateLogs_PrefersFinalised()
    {
        var plan = BuildPlan();

        // Finalised log — all three sets stamped.
        var finalisedLog = BuildLog(
            isCompleted: true,
            setStamps:
            [
                (1, _now.AddMinutes(-30)),
                (2, _now.AddMinutes(-25)),
                (3, _now.AddMinutes(-20))
            ],
            dateUpdated: _now.AddMinutes(-10));

        // Newer in-progress log (e.g. client re-opened session after finalising).
        var inProgressLog = BuildLog(
            isCompleted: false,
            setStamps: [(1, _now.AddMinutes(-5))],
            dateUpdated: null);

        var response = await ExecuteAsync(plan, [inProgressLog, finalisedLog]);

        response.Should().NotBeNull();
        // One SessionExecution entry — not two.
        response!.SessionExecutions.Should().HaveCount(1);

        var exec = response.SessionExecutions.Single();
        exec.IsSessionFinished.Should().BeTrue("finalised log must be preferred over in-progress");
        exec.CompletedSetsByExercise.Should().ContainKey(_exerciseId);
        exec.CompletedSetsByExercise[_exerciseId].Should().BeEquivalentTo(new[] { 1, 2, 3 });
    }

    /// <summary>
    /// Non-owning trainer cannot see the plan — ownership gate is preserved
    /// and runs before the WorkoutLog fetch.
    /// </summary>
    [Fact]
    public async Task HandleAsync_NotOwner_Returns404_WorkoutLogFetchSkipped()
    {
        var plan = BuildPlan(); // plan.TrainerId == _trainerId
        var otherTrainerId = Guid.NewGuid();

        var mongo = TrainingPlanTestHelpers.CreateMockMongoWithLogs(
            plans: [plan],
            workoutLogs: []);

        var ep = Factory.Create<GetTrainingPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(otherTrainerId, AppRoles.Trainer))),
            mongo,
            TrainingPlanTestHelpers.CreateNoOpLockService(),
            new MockDbBuilder().Build());

        await ep.HandleAsync(
            new GetTrainingPlanRequest { PlanId = _planId },
            TestContext.Current.CancellationToken);

        ep.HttpContext.Response.StatusCode.Should().Be(404);
    }
}
