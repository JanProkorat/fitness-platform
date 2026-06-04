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
/// Tests for the <see cref="GetTrainingPlanEndpoint"/> <c>SessionExecutions</c> fold-in
/// using <see cref="TrainingCompletion"/> documents (the mobile home-checkbox path).
///
/// The live path (WorkoutLog.IsCompleted=true) is already covered by
/// <see cref="GetTrainingPlanSessionExecutionTests"/>. This class covers the checkbox path.
///
/// Issue #429 follow-up: sessions finished via the mobile "mark whole day complete" checkbox
/// produce a TrainingCompletion document but NOT a WorkoutLog. Without this fix, those sessions
/// would never appear as IsSessionFinished=true on the trainer portal.
/// </summary>
public class GetTrainingPlanCompletionFinishedStateTests
{
    private readonly Guid _trainerId = Guid.NewGuid();
    private readonly Guid _clientId = Guid.NewGuid();
    private readonly Guid _planId = Guid.NewGuid();
    private readonly Guid _sessionId = Guid.NewGuid();
    private readonly Guid _sectionId = Guid.NewGuid();
    private readonly Guid _exerciseId = Guid.NewGuid();
    private readonly DateTime _now = DateTime.UtcNow;

    // ── Builder helpers ───────────────────────────────────────────────────────

    private TrainingPlan BuildPlan()
    {
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
                    Sessions =
                    [
                        new TrainingSession
                        {
                            SessionId = _sessionId,
                            Name = "Session 1",
                            DayOfWeek = 1,
                            Sections =
                            [
                                new TrainingSection
                                {
                                    SectionId = _sectionId,
                                    Order = 0,
                                    Name = "Hlavní",
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
                                                new ExerciseSet { SetNumber = 2, Reps = 10 }
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
            DateCreated = _now
        };
    }

    private TrainingCompletion BuildCompletion(List<Guid> completedExerciseIds)
    {
        return new TrainingCompletion
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            Date = _now.Date,
            SessionId = _sessionId,
            CompletedExerciseIds = completedExerciseIds,
            Version = 1,
            DateCreated = _now
        };
    }

    private async Task<GetTrainingPlanResponse?> ExecuteAsync(
        TrainingPlan plan,
        WorkoutLog[] logs,
        TrainingCompletion[] completions)
    {
        var mongo = TrainingPlanTestHelpers.CreateMockMongoWithLogs(
            plans: [plan],
            workoutLogs: logs,
            trainingCompletions: completions);

        var ep = Factory.Create<GetTrainingPlanEndpoint>(
            ctx => ctx.Request.HttpContext.User = new ClaimsPrincipal(
                new ClaimsIdentity(EndpointTestHelpers.FakeUserClaims(_trainerId, AppRoles.Trainer))),
            mongo,
            TrainingPlanTestHelpers.CreateNoOpLockService());

        await ep.HandleAsync(
            new GetTrainingPlanRequest { PlanId = _planId },
            TestContext.Current.CancellationToken);

        return ep.HttpContext.Response.StatusCode == 200 ? ep.Response : null;
    }

    // ── Test cases ────────────────────────────────────────────────────────────

    /// <summary>
    /// A fully-complete TrainingCompletion with no WorkoutLog at all must produce a synthetic
    /// SessionExecutionDto entry with IsSessionFinished=true and empty CompletedSetsByExercise.
    /// This is the core home-checkbox path (#429 fix).
    /// </summary>
    [Fact]
    public async Task SessionExecutions_FullyCompleteTrainingCompletion_NoWorkoutLog_IsSessionFinishedTrue()
    {
        var plan = BuildPlan();
        var completion = BuildCompletion([_exerciseId]); // all exercises done

        var response = await ExecuteAsync(plan, logs: [], completions: [completion]);

        response.Should().NotBeNull();
        response!.SessionExecutions.Should().HaveCount(1,
            "a synthetic entry must be emitted for a session with only a TrainingCompletion");

        var exec = response.SessionExecutions.Single();
        exec.SessionId.Should().Be(_sessionId);
        exec.IsSessionFinished.Should().BeTrue(
            "fully-complete TrainingCompletion must set IsSessionFinished=true");
        exec.CompletedSetsByExercise.Should().BeEmpty(
            "the checkbox path has no set-level data — CompletedSetsByExercise must be empty");
    }

    /// <summary>
    /// A PARTIAL TrainingCompletion (not all exercises done) must NOT produce a finished entry.
    /// </summary>
    [Fact]
    public async Task SessionExecutions_PartialTrainingCompletion_NoWorkoutLog_IsSessionFinishedFalse()
    {
        var plan = BuildPlan();
        // Only half done — the plan has one exercise; partial means empty list here.
        var partialCompletion = BuildCompletion([]); // no exercises completed

        var response = await ExecuteAsync(plan, logs: [], completions: [partialCompletion]);

        response.Should().NotBeNull();
        // No entry at all, or an entry with IsSessionFinished=false (either is acceptable;
        // the important thing is there is no IsSessionFinished=true entry).
        var finishedEntry = response!.SessionExecutions
            .FirstOrDefault(e => e.SessionId == _sessionId);
        if (finishedEntry is not null)
        {
            finishedEntry.IsSessionFinished.Should().BeFalse(
                "a partial TrainingCompletion must not mark the session finished");
        }
    }

    /// <summary>
    /// When BOTH a completed WorkoutLog and a fully-complete TrainingCompletion exist,
    /// the result must have exactly one entry (no duplicate) with IsSessionFinished=true.
    /// </summary>
    [Fact]
    public async Task SessionExecutions_BothWorkoutLogAndCompletion_NoDuplicateEntry()
    {
        var plan = BuildPlan();
        var completion = BuildCompletion([_exerciseId]);

        var log = new WorkoutLog
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
                    Name = "Hlavní",
                    Exercises =
                    [
                        new WorkoutExercise
                        {
                            ExerciseExternalId = _exerciseId,
                            ExerciseName = "Squat",
                            Sets =
                            [
                                new WorkoutSet { SetNumber = 1, Reps = 10, CompletedAt = _now.AddMinutes(-20) },
                                new WorkoutSet { SetNumber = 2, Reps = 10, CompletedAt = _now.AddMinutes(-15) }
                            ]
                        }
                    ]
                }
            ],
            DateCreated = _now.AddMinutes(-35)
        };

        var response = await ExecuteAsync(plan, logs: [log], completions: [completion]);

        response.Should().NotBeNull();
        // Must be exactly one entry — not two (no duplicate synthesis).
        response!.SessionExecutions.Should().HaveCount(1,
            "WorkoutLog entry must not be duplicated when a TrainingCompletion also exists");

        var exec = response.SessionExecutions.Single();
        exec.SessionId.Should().Be(_sessionId);
        exec.IsSessionFinished.Should().BeTrue();
    }

    /// <summary>
    /// When a WorkoutLog exists but IsCompleted=false, and a fully-complete TrainingCompletion
    /// also exists, the IsSessionFinished flag must be OR-ed in from the completion.
    /// </summary>
    [Fact]
    public async Task SessionExecutions_InProgressWorkoutLog_FullyCompleteTrainingCompletion_IsSessionFinishedTrue()
    {
        var plan = BuildPlan();
        var completion = BuildCompletion([_exerciseId]); // fully done via checkbox

        // WorkoutLog in-progress (not completed).
        var log = new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = Guid.NewGuid(),
            PlanId = _planId,
            SessionId = _sessionId,
            StartedAt = _now.AddMinutes(-30),
            IsCompleted = false,
            CompletedAt = null,
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
                            ExerciseExternalId = _exerciseId,
                            ExerciseName = "Squat",
                            Sets = [new WorkoutSet { SetNumber = 1, Reps = 10, CompletedAt = _now.AddMinutes(-20) }]
                        }
                    ]
                }
            ],
            DateCreated = _now.AddMinutes(-35)
        };

        var response = await ExecuteAsync(plan, logs: [log], completions: [completion]);

        response.Should().NotBeNull();
        response!.SessionExecutions.Should().HaveCount(1);

        var exec = response.SessionExecutions.Single();
        exec.IsSessionFinished.Should().BeTrue(
            "fully-complete TrainingCompletion must OR-in IsSessionFinished=true even when the WorkoutLog is not finalised");
    }

    /// <summary>
    /// No TrainingCompletion and no WorkoutLog → SessionExecutions is empty (unchanged baseline).
    /// </summary>
    [Fact]
    public async Task SessionExecutions_NoCompletionAndNoWorkoutLog_IsEmpty()
    {
        var plan = BuildPlan();

        var response = await ExecuteAsync(plan, logs: [], completions: []);

        response.Should().NotBeNull();
        response!.SessionExecutions.Should().BeEmpty();
    }
}
