using System.Security.Claims;
using FastEndpoints;
using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.TrainingPlans.GetTrainingPlan;
using FitnessPlatform.Tests.Endpoints;

namespace FitnessPlatform.Tests.Endpoints.TrainingPlans;

/// <summary>
/// Tests for the <see cref="GetTrainingPlanEndpoint"/> <c>SessionExecutionDto</c>
/// planned-vs-actual extension (issue #440):
/// — <c>LoggedSetsByExercise</c> carries actual + snapshot-planned + isModified per set.
/// — <c>HasModifications</c> is true when any set in the session is modified.
/// — Backward compatibility: legacy sets without planned fields → isModified=false.
/// </summary>
public class GetTrainingPlanLoggedSetsTests
{
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly Guid _planId = Guid.NewGuid();
    private readonly Guid _sessionId = Guid.NewGuid();
    private readonly Guid _exerciseId = Guid.NewGuid();
    private readonly DateTime _now = DateTime.UtcNow;

    private TrainingPlan BuildPlan()
    {
        var session = new TrainingSession
        {
            SessionId = _sessionId,
            Name = "Session 1",
            DayOfWeek = 1,
            Sections =
            [
                new TrainingSection
                {
                    SectionId = Guid.NewGuid(),
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
                                new ExerciseSet { SetNumber = 1, Reps = 10, WeightKg = 80m },
                                new ExerciseSet { SetNumber = 2, Reps = 10, WeightKg = 80m }
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

    private WorkoutLog BuildLog(List<WorkoutSet> sets)
    {
        return new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = Guid.NewGuid(),
            PlanId = _planId,
            SessionId = _sessionId,
            StartedAt = _now.AddMinutes(-30),
            IsCompleted = true,
            CompletedAt = _now,
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
                            Sets = sets
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
            TrainingPlanTestHelpers.CreateNoOpLockService());

        await ep.HandleAsync(
            new GetTrainingPlanRequest { PlanId = _planId },
            TestContext.Current.CancellationToken);

        if (ep.HttpContext.Response.StatusCode != 200)
            return null;

        return ep.Response;
    }

    // ── LoggedSetsByExercise populated correctly ────────────────────────────────

    [Fact]
    public async Task SessionExecution_WithPlannedSnapshot_LoggedSetsByExerciseContainsActualAndPlanned()
    {
        var plan = BuildPlan();
        var log = BuildLog(
        [
            new WorkoutSet
            {
                SetNumber = 1,
                Reps = 10,
                WeightKg = 80m,
                PlannedReps = 10,
                PlannedWeightKg = 80m,
                CompletedAt = _now.AddMinutes(-20)
            },
            new WorkoutSet
            {
                SetNumber = 2,
                Reps = 8,           // fewer than planned
                WeightKg = 80m,
                PlannedReps = 10,   // planned was 10
                PlannedWeightKg = 80m,
                CompletedAt = _now.AddMinutes(-15)
            }
        ]);

        var response = await ExecuteAsync(plan, [log]);

        response.Should().NotBeNull();
        response!.SessionExecutions.Should().HaveCount(1);

        var exec = response.SessionExecutions.Single();
        exec.LoggedSetsByExercise.Should().ContainKey(_exerciseId);

        var sets = exec.LoggedSetsByExercise[_exerciseId];
        sets.Should().HaveCount(2);

        var set1 = sets.Single(s => s.SetNumber == 1);
        set1.ActualReps.Should().Be(10);
        set1.PlannedReps.Should().Be(10);
        set1.IsModified.Should().BeFalse();

        var set2 = sets.Single(s => s.SetNumber == 2);
        set2.ActualReps.Should().Be(8);
        set2.PlannedReps.Should().Be(10);
        set2.IsModified.Should().BeTrue();
    }

    // ── HasModifications set when any set is modified ──────────────────────────

    [Fact]
    public async Task SessionExecution_WithModifiedSet_HasModificationsTrue()
    {
        var plan = BuildPlan();
        var log = BuildLog(
        [
            new WorkoutSet
            {
                SetNumber = 1,
                Reps = 6,           // diverges from plan
                WeightKg = 80m,
                PlannedReps = 10,
                PlannedWeightKg = 80m,
                CompletedAt = _now.AddMinutes(-25)
            }
        ]);

        var response = await ExecuteAsync(plan, [log]);

        response.Should().NotBeNull();
        var exec = response!.SessionExecutions.Single();
        exec.HasModifications.Should().BeTrue();
    }

    [Fact]
    public async Task SessionExecution_AllSetsAsPlanned_HasModificationsFalse()
    {
        var plan = BuildPlan();
        var log = BuildLog(
        [
            new WorkoutSet
            {
                SetNumber = 1,
                Reps = 10,
                WeightKg = 80m,
                PlannedReps = 10,
                PlannedWeightKg = 80m,
                CompletedAt = _now.AddMinutes(-25)
            },
            new WorkoutSet
            {
                SetNumber = 2,
                Reps = 10,
                WeightKg = 80m,
                PlannedReps = 10,
                PlannedWeightKg = 80m,
                CompletedAt = _now.AddMinutes(-20)
            }
        ]);

        var response = await ExecuteAsync(plan, [log]);

        response.Should().NotBeNull();
        var exec = response!.SessionExecutions.Single();
        exec.HasModifications.Should().BeFalse();
    }

    // ── Backward compatibility: legacy log without planned fields ──────────────

    [Fact]
    public async Task SessionExecution_LegacySetWithoutPlannedFields_IsModifiedFalseAndPlannedNull()
    {
        var plan = BuildPlan();
        var log = BuildLog(
        [
            new WorkoutSet
            {
                SetNumber = 1,
                Reps = 10,
                WeightKg = 80m,
                // No planned fields — legacy document
                CompletedAt = _now.AddMinutes(-25)
            }
        ]);

        var response = await ExecuteAsync(plan, [log]);

        response.Should().NotBeNull();
        var exec = response!.SessionExecutions.Single();
        exec.HasModifications.Should().BeFalse();

        exec.LoggedSetsByExercise.Should().ContainKey(_exerciseId);
        var set = exec.LoggedSetsByExercise[_exerciseId].Single();
        set.IsModified.Should().BeFalse();
        set.PlannedReps.Should().BeNull();
    }

    // ── No log → SessionExecution absent → LoggedSetsByExercise empty ──────────

    [Fact]
    public async Task SessionExecution_NoLog_LoggedSetsByExerciseIsEmpty()
    {
        var plan = BuildPlan();
        var response = await ExecuteAsync(plan, []);

        response.Should().NotBeNull();
        response!.SessionExecutions.Should().BeEmpty();
    }
}
