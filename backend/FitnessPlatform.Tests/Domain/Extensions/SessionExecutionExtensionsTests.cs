using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Extensions;
using FluentAssertions;

namespace FitnessPlatform.Tests.Domain.Extensions;

/// <summary>
/// Unit tests for the canonical placement-exact completion rule (#938) on
/// <see cref="SessionExecutionExtensions"/>. Covers the three resolution branches directly against
/// the extension methods, without booting a full endpoint host — the integration-level agreement
/// between <c>GetTodaySession</c> and <c>GetFullTrainingPlan</c> is covered separately in
/// <c>GetTodaySessionProjectionIntegrationTests</c>.
/// </summary>
public class SessionExecutionExtensionsTests
{
    private static TrainingSession BuildDualPlacementSession(
        Guid catalogExerciseId, Guid standaloneInstanceId, Guid nestedInstanceId, Guid workoutId)
    {
        return new TrainingSession
        {
            SessionId = Guid.NewGuid(),
            Name = "Dual Placement Session",
            Order = 1,
            Workouts =
            [
                new TrainingWorkout
                {
                    WorkoutId = workoutId,
                    Order = 0,
                    Name = "Hlavní",
                    Exercises =
                    [
                        new SessionExercise
                        {
                            ExerciseId = nestedInstanceId,
                            ExerciseExternalId = catalogExerciseId,
                            ExerciseName = "Wall Ball",
                            Order = 1,
                            Sets = [new ExerciseSet { SetNumber = 1, Type = SetType.Normal, Reps = 20 }]
                        }
                    ]
                }
            ],
            StandaloneExercises =
            [
                new SessionExercise
                {
                    ExerciseId = standaloneInstanceId,
                    ExerciseExternalId = catalogExerciseId,
                    ExerciseName = "Wall Ball",
                    Order = 1,
                    Sets = [new ExerciseSet { SetNumber = 1, Type = SetType.Normal, Reps = 15 }]
                }
            ]
        };
    }

    private static SessionExecution BuildFullyLoggedExecution(Guid catalogExerciseId, Guid loggedWorkoutId)
    {
        return new SessionExecution
        {
            ExternalId = Guid.NewGuid(),
            ClientId = Guid.NewGuid(),
            SessionId = Guid.NewGuid(),
            Date = DateTime.UtcNow.Date,
            Status = SessionExecutionStatus.Partial,
            CompletedExerciseInstanceIds = [],
            DateCreated = DateTime.UtcNow,
            Version = 1,
            Performance = new SessionExecutionPerformance
            {
                StartedAt = DateTime.UtcNow.AddMinutes(-10),
                Workouts =
                [
                    new LoggedWorkout
                    {
                        WorkoutId = loggedWorkoutId,
                        Order = 0,
                        Name = "Hlavní",
                        Exercises =
                        [
                            new WorkoutExercise
                            {
                                ExerciseExternalId = catalogExerciseId,
                                ExerciseName = "Wall Ball",
                                Sets = [new WorkoutSet { SetNumber = 1, Reps = 20, CompletedAt = DateTime.UtcNow }]
                            }
                        ]
                    }
                ]
            }
        };
    }

    [Fact]
    public void ResolveCompletedInstanceIds_PlacementExact_AttributesOnlyTheLoggedWorkoutsInstance()
    {
        var catalogExerciseId = Guid.NewGuid();
        var standaloneInstanceId = Guid.NewGuid();
        var nestedInstanceId = Guid.NewGuid();
        var workoutId = Guid.NewGuid();

        var session = BuildDualPlacementSession(catalogExerciseId, standaloneInstanceId, nestedInstanceId, workoutId);
        var execution = BuildFullyLoggedExecution(catalogExerciseId, loggedWorkoutId: workoutId);

        var result = execution.ResolveCompletedInstanceIds(session);

        result.Should().BeEquivalentTo([nestedInstanceId],
            "the logged workoutId matches the real nested workout, so attribution is placement-exact");
    }

    [Fact]
    public void ResolveCompletedInstanceIds_Unattributable_FansOutToEverySiblingSharingTheCatalogId()
    {
        var catalogExerciseId = Guid.NewGuid();
        var standaloneInstanceId = Guid.NewGuid();
        var nestedInstanceId = Guid.NewGuid();
        var workoutId = Guid.NewGuid();

        var session = BuildDualPlacementSession(catalogExerciseId, standaloneInstanceId, nestedInstanceId, workoutId);
        // Logged workoutId matches NO real nested workout in the session.
        var execution = BuildFullyLoggedExecution(catalogExerciseId, loggedWorkoutId: Guid.NewGuid());

        var result = execution.ResolveCompletedInstanceIds(session);

        result.Should().BeEquivalentTo([standaloneInstanceId, nestedInstanceId],
            "attribution is genuinely impossible, so both siblings sharing the catalog id are reported complete");
    }

    [Fact]
    public void ResolveCompletedInstanceIds_TiedPlacementInSameWorkout_FansOutToBothTiedInstancesOnly()
    {
        var catalogExerciseId = Guid.NewGuid();
        var firstTiedInstanceId = Guid.NewGuid();
        var secondTiedInstanceId = Guid.NewGuid();
        var workoutId = Guid.NewGuid();

        var session = new TrainingSession
        {
            SessionId = Guid.NewGuid(),
            Name = "Tied Placement Session",
            Order = 1,
            Workouts =
            [
                new TrainingWorkout
                {
                    WorkoutId = workoutId,
                    Order = 0,
                    Name = "Hlavní",
                    Exercises =
                    [
                        new SessionExercise
                        {
                            ExerciseId = firstTiedInstanceId,
                            ExerciseExternalId = catalogExerciseId,
                            ExerciseName = "Wall Ball",
                            Order = 1,
                            Sets = [new ExerciseSet { SetNumber = 1, Type = SetType.Normal, Reps = 20 }]
                        },
                        new SessionExercise
                        {
                            ExerciseId = secondTiedInstanceId,
                            ExerciseExternalId = catalogExerciseId,
                            ExerciseName = "Wall Ball",
                            Order = 2,
                            Sets = [new ExerciseSet { SetNumber = 1, Type = SetType.Normal, Reps = 20 }]
                        }
                    ]
                }
            ]
        };
        var execution = BuildFullyLoggedExecution(catalogExerciseId, loggedWorkoutId: workoutId);

        var result = execution.ResolveCompletedInstanceIds(session);

        result.Should().BeEquivalentTo([firstTiedInstanceId, secondTiedInstanceId],
            "the same catalog exercise placed twice in the SAME workout is genuinely unresolvable, so both tied instances are reported complete");
    }

    [Fact]
    public void ResolveCompletedInstanceIds_NoPerformance_ReturnsRawCheckboxIdsVerbatim()
    {
        var catalogExerciseId = Guid.NewGuid();
        var standaloneInstanceId = Guid.NewGuid();
        var nestedInstanceId = Guid.NewGuid();
        var workoutId = Guid.NewGuid();

        var session = BuildDualPlacementSession(catalogExerciseId, standaloneInstanceId, nestedInstanceId, workoutId);
        var execution = new SessionExecution
        {
            ExternalId = Guid.NewGuid(),
            ClientId = Guid.NewGuid(),
            SessionId = session.SessionId,
            Date = DateTime.UtcNow.Date,
            Status = SessionExecutionStatus.Partial,
            CompletedExerciseInstanceIds = [standaloneInstanceId],
            DateCreated = DateTime.UtcNow,
            Version = 1
        };

        var result = execution.ResolveCompletedInstanceIds(session);

        result.Should().BeEquivalentTo([standaloneInstanceId]);
    }

    [Fact]
    public void ResolveLoggedWorkoutKey_MatchingRealWorkout_ReturnsTheSameId()
    {
        var workoutId = Guid.NewGuid();
        var session = new TrainingSession
        {
            SessionId = Guid.NewGuid(),
            Workouts = [new TrainingWorkout { WorkoutId = workoutId, Order = 0, Name = "Hlavní" }]
        };

        session.ResolveLoggedWorkoutKey(workoutId).Should().Be(workoutId);
    }

    [Fact]
    public void ResolveLoggedWorkoutKey_NoMatchingWorkout_ReturnsNull()
    {
        var session = new TrainingSession
        {
            SessionId = Guid.NewGuid(),
            Workouts = [new TrainingWorkout { WorkoutId = Guid.NewGuid(), Order = 0, Name = "Hlavní" }]
        };

        session.ResolveLoggedWorkoutKey(Guid.NewGuid()).Should().BeNull();
    }
}
