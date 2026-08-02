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
                            Workouts =
                            [
                                new TrainingWorkout
                                {
                                    WorkoutId = _sectionId,
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
            TrainingPlanTestHelpers.CreateNoOpLockService(),
            new MockDbBuilder().Build());

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
            Workouts =
            [
                new LoggedWorkout
                {
                    WorkoutId = Guid.NewGuid(),
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
            Workouts =
            [
                new LoggedWorkout
                {
                    WorkoutId = Guid.NewGuid(),
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

    // ── FinishedSections projection tests (issue #465) ────────────────────────────

    private readonly Guid _sectionAId = Guid.NewGuid();
    private readonly Guid _sectionBId = Guid.NewGuid();
    private readonly Guid _exerciseAId = Guid.NewGuid();
    private readonly Guid _exerciseBId = Guid.NewGuid();

    /// <summary>
    /// Builds a plan with two sections, each containing one exercise.
    /// </summary>
    private TrainingPlan BuildTwoSectionPlan()
    {
        return new TrainingPlan
        {
            ExternalId = _planId,
            ClientId = _clientId,
            TrainerId = _trainerId,
            Name = "Two-Section Plan",
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
                            Workouts =
                            [
                                new TrainingWorkout
                                {
                                    WorkoutId = _sectionAId,
                                    Order = 0,
                                    Name = "Section A",
                                    Exercises =
                                    [
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = _exerciseAId,
                                            ExerciseName = "Squat",
                                            Order = 0,
                                            Sets = [new ExerciseSet { SetNumber = 1, Reps = 10 }]
                                        }
                                    ]
                                },
                                new TrainingWorkout
                                {
                                    WorkoutId = _sectionBId,
                                    Order = 1,
                                    Name = "Section B",
                                    Exercises =
                                    [
                                        new SessionExercise
                                        {
                                            ExerciseExternalId = _exerciseBId,
                                            ExerciseName = "Press",
                                            Order = 0,
                                            Sets = [new ExerciseSet { SetNumber = 1, Reps = 8 }]
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

    /// <summary>
    /// When a TrainingCompletion records both sections as complete, both sections must appear
    /// in FinishedSections with IsFinished=true.
    /// </summary>
    [Fact]
    public async Task FinishedSections_FullyCompleteCompletion_AllSectionsReportedFinished()
    {
        var plan = BuildTwoSectionPlan();

        var completion = new TrainingCompletion
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            Date = _now.Date,
            SessionId = _sessionId,
            CompletedExerciseIds = [_exerciseAId, _exerciseBId],
            CompletedExerciseIdsBySection = new Dictionary<string, List<Guid>>
            {
                [_sectionAId.ToString()] = [_exerciseAId],
                [_sectionBId.ToString()] = [_exerciseBId]
            },
            Version = 1,
            DateCreated = _now
        };

        var response = await ExecuteAsync(plan, logs: [], completions: [completion]);

        response.Should().NotBeNull();
        var exec = response!.SessionExecutions.FirstOrDefault(e => e.SessionId == _sessionId);
        exec.Should().NotBeNull("a session entry must be present when completion data exists");
        exec!.FinishedWorkouts.Should().HaveCount(2,
            "both sections are complete so both must appear in FinishedSections");
        exec.FinishedWorkouts.Should().Contain(s => s.SectionId == _sectionAId && s.IsFinished);
        exec.FinishedWorkouts.Should().Contain(s => s.SectionId == _sectionBId && s.IsFinished);
    }

    /// <summary>
    /// A completed WorkoutLog (IsCompleted=true) implies session-level completion — all sections
    /// in the session must appear as finished in FinishedSections.
    /// </summary>
    [Fact]
    public async Task FinishedSections_CompletedWorkoutLog_AllSectionsReportedFinished()
    {
        var plan = BuildTwoSectionPlan();

        var log = new WorkoutLog
        {
            ExternalId = Guid.NewGuid(),
            ClientId = Guid.NewGuid(),
            PlanId = _planId,
            SessionId = _sessionId,
            StartedAt = _now.AddMinutes(-30),
            IsCompleted = true,
            CompletedAt = _now,
            Workouts =
            [
                new LoggedWorkout
                {
                    WorkoutId = _sectionAId, Order = 0, Name = "Section A",
                    Exercises = [new WorkoutExercise
                    {
                        ExerciseExternalId = _exerciseAId, ExerciseName = "Squat",
                        Sets = [new WorkoutSet { SetNumber = 1, CompletedAt = _now.AddMinutes(-20) }]
                    }]
                },
                new LoggedWorkout
                {
                    WorkoutId = _sectionBId, Order = 1, Name = "Section B",
                    Exercises = [new WorkoutExercise
                    {
                        ExerciseExternalId = _exerciseBId, ExerciseName = "Press",
                        Sets = [new WorkoutSet { SetNumber = 1, CompletedAt = _now.AddMinutes(-10) }]
                    }]
                }
            ],
            DateCreated = _now.AddMinutes(-35)
        };

        var response = await ExecuteAsync(plan, logs: [log], completions: []);

        response.Should().NotBeNull();
        var exec = response!.SessionExecutions.FirstOrDefault(e => e.SessionId == _sessionId);
        exec.Should().NotBeNull();
        exec!.IsSessionFinished.Should().BeTrue();
        exec.FinishedWorkouts.Should().HaveCount(2,
            "a completed WorkoutLog implies all sections are done");
        exec.FinishedWorkouts.Should().Contain(s => s.SectionId == _sectionAId && s.IsFinished);
        exec.FinishedWorkouts.Should().Contain(s => s.SectionId == _sectionBId && s.IsFinished);
    }

    /// <summary>
    /// When only section A is finished (TrainingCompletion records only section A's exercise),
    /// only section A must appear in FinishedSections — section B must NOT.
    /// This is the key MIXED-STATE case from issue #465.
    /// </summary>
    [Fact]
    public async Task FinishedSections_PartialCompletion_OnlyFinishedSectionReported()
    {
        var plan = BuildTwoSectionPlan();

        // Only section A's exercise is completed — section B is not done.
        var completion = new TrainingCompletion
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            Date = _now.Date,
            SessionId = _sessionId,
            CompletedExerciseIds = [_exerciseAId],
            CompletedExerciseIdsBySection = new Dictionary<string, List<Guid>>
            {
                [_sectionAId.ToString()] = [_exerciseAId]
            },
            Version = 1,
            DateCreated = _now
        };

        var response = await ExecuteAsync(plan, logs: [], completions: [completion]);

        response.Should().NotBeNull();
        var exec = response!.SessionExecutions.FirstOrDefault(e => e.SessionId == _sessionId);
        exec.Should().NotBeNull();
        exec!.FinishedWorkouts.Should().HaveCount(1,
            "only the finished section must appear — not the unfinished one");
        exec.FinishedWorkouts.Should().Contain(s => s.SectionId == _sectionAId && s.IsFinished);
        exec.FinishedWorkouts.Should().NotContain(s => s.SectionId == _sectionBId,
            "section B is not finished so it must not appear in FinishedSections");
    }

    /// <summary>
    /// When there is no completion data at all, FinishedSections must be empty.
    /// </summary>
    [Fact]
    public async Task FinishedSections_NoCompletion_IsEmpty()
    {
        var plan = BuildTwoSectionPlan();

        var response = await ExecuteAsync(plan, logs: [], completions: []);

        response.Should().NotBeNull();
        // Either no entry at all, or an entry with empty FinishedSections.
        var exec = response!.SessionExecutions.FirstOrDefault(e => e.SessionId == _sessionId);
        if (exec is not null)
        {
            exec.FinishedWorkouts.Should().BeEmpty(
                "no completion data means FinishedSections must be empty");
        }
    }

    /// <summary>
    /// Regression test for Defect 2: a session with zero sections must never be treated as
    /// vacuously complete — <c>Enumerable.All()</c> over an empty collection returns <c>true</c>,
    /// which would cause any completion doc (even an empty one) to match.
    ///
    /// A zero-section session indicates an empty/corrupt session definition (every
    /// TrainingSession document is guaranteed to carry a populated sections list post-#837).
    /// Even with a non-empty TrainingCompletion document for that session, IsSessionFinished
    /// must remain false.
    /// </summary>
    [Fact]
    public async Task SessionExecutions_ZeroSectionSession_NonEmptyCompletion_IsSessionFinishedFalse()
    {
        // Build a plan where the session has NO sections (empty/corrupt definition).
        var plan = BuildPlan();
        plan.Weeks[0].Sessions[0].Workouts = []; // zero sections

        // A non-empty completion doc that would match vacuously under the old All() check.
        var completion = new TrainingCompletion
        {
            ExternalId = Guid.NewGuid(),
            ClientId = _clientId,
            Date = _now.Date,
            SessionId = _sessionId,
            CompletedExerciseIds = [_exerciseId], // non-empty flat list
            CompletedExerciseIdsBySection = new Dictionary<string, List<Guid>>
            {
                [_sectionId.ToString()] = [_exerciseId]
            },
            Version = 1,
            DateCreated = _now
        };

        var response = await ExecuteAsync(plan, logs: [], completions: [completion]);

        response.Should().NotBeNull();

        // No IsSessionFinished=true entry must appear for the zero-section session.
        var finishedEntry = response!.SessionExecutions
            .FirstOrDefault(e => e.SessionId == _sessionId);
        if (finishedEntry is not null)
        {
            finishedEntry.IsSessionFinished.Should().BeFalse(
                "a zero-section session must never be reported as finished, even with a non-empty completion");
        }
    }
}
