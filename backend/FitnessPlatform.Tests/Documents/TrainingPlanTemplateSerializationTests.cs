using System.Reflection;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FluentAssertions;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;

namespace FitnessPlatform.Tests.Documents;

/// <summary>
/// Unit tests proving the <see cref="TrainingPlanTemplate"/> document's shape (#862): a
/// field-absent <c>visibility</c> deserializes to <see cref="LibraryVisibility.Private"/>, no
/// client-only field (<c>ClientId</c>, <c>Status</c>, <c>StartDate</c>, publish/complete dates,
/// <c>QuestionnaireResponseId</c>, <c>TargetWeightKg</c>) exists on the type at all, and cloning
/// <see cref="TrainingSession.StandaloneExercises"/> never pulls in the computed
/// <see cref="TrainingSession.AllExercises"/> view. No Docker required — pure BSON
/// (de)serialization against an in-memory document.
/// </summary>
public class TrainingPlanTemplateSerializationTests
{
    /// <summary>
    /// The client-only fields that must be absent from <see cref="TrainingPlanTemplate"/> by
    /// construction, not merely nulled out — see issue #862's document spec.
    /// </summary>
    private static readonly string[] ClientOnlyFieldNames =
    [
        "ClientId",
        "Status",
        "StartDate",
        "DatePublished",
        "DateCompleted",
        "QuestionnaireResponseId",
        "TargetWeightKg"
    ];

    [Fact]
    public void TrainingPlanTemplate_HasNoClientOnlyFields()
    {
        var propertyNames = typeof(TrainingPlanTemplate)
            .GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Select(p => p.Name)
            .ToList();

        propertyNames.Should().NotContain(ClientOnlyFieldNames,
            "client-only fields must be absent from the template document by construction");
    }

    [Fact]
    public void Visibility_FieldAbsentOnRealDocument_DeserializesToPrivate()
    {
        // Start from Public so a bug that falls back to default(T) via a different path
        // (rather than genuinely reading the missing-initializer field) cannot accidentally pass.
        var original = new TrainingPlanTemplate
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = Guid.NewGuid(),
            Name = "Test Template",
            Visibility = LibraryVisibility.Public,
            DateCreated = DateTime.UtcNow
        };

        var bsonDoc = original.ToBsonDocument();
        bsonDoc.Remove("visibility");

        var deserialized = BsonSerializer.Deserialize<TrainingPlanTemplate>(bsonDoc);

        deserialized.Visibility.Should().Be(LibraryVisibility.Private);
    }

    [Fact]
    public void TrainingPlanTemplate_RoundTripsWeeksSessionsAndWorkouts()
    {
        var sessionId = Guid.NewGuid();
        var workoutId = Guid.NewGuid();
        var exerciseId = Guid.NewGuid();

        var original = new TrainingPlanTemplate
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = Guid.NewGuid(),
            Name = "Round Trip Template",
            Goal = PrimaryGoal.GainMuscle,
            Difficulty = ExerciseDifficulty.Intermediate,
            Visibility = LibraryVisibility.Public,
            DateCreated = DateTime.UtcNow,
            Weeks =
            [
                new TrainingTemplateWeek
                {
                    WeekNumber = 1,
                    Days =
                    [
                        new TrainingDay
                        {
                            DayOfWeek = 1,
                            Sessions =
                            [
                                new TrainingSession
                                {
                                    SessionId = sessionId,
                                    Name = "Push Day",
                                    Order = 1,
                                    Workouts =
                                    [
                                        new TrainingWorkout
                                        {
                                            WorkoutId = workoutId,
                                            Order = 0,
                                            Name = "Main",
                                            Exercises = [new SessionExercise { ExerciseId = exerciseId, ExerciseName = "Bench Press", Order = 1 }]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ],
            WeekCount = 1
        };

        var bsonDoc = original.ToBsonDocument();
        var deserialized = BsonSerializer.Deserialize<TrainingPlanTemplate>(bsonDoc);

        deserialized.Weeks.Should().HaveCount(1);
        deserialized.Weeks[0].Days.Should().ContainSingle().Which.DayOfWeek.Should().Be(1);
        var session = deserialized.Weeks[0].Days[0].Sessions.Should().ContainSingle().Subject;
        session.SessionId.Should().Be(sessionId);
        session.Workouts.Should().ContainSingle().Which.WorkoutId.Should().Be(workoutId);
        session.Workouts[0].Exercises.Should().ContainSingle().Which.ExerciseId.Should().Be(exerciseId);
        deserialized.Goal.Should().Be(PrimaryGoal.GainMuscle);
        deserialized.Difficulty.Should().Be(ExerciseDifficulty.Intermediate);
    }

    /// <summary>
    /// Pins the cloning-ban property at the document level: a session whose exercises live only
    /// under a workout (none standalone) still reports them via the computed
    /// <see cref="TrainingSession.AllExercises"/> view, but that view is never a persisted BSON
    /// element — round-tripping the session through BSON must not resurrect any exercise into
    /// <see cref="TrainingSession.StandaloneExercises"/>.
    /// </summary>
    [Fact]
    public void TrainingSession_AllExercises_IsComputedNeverPersisted()
    {
        var workoutExerciseId = Guid.NewGuid();

        var session = new TrainingSession
        {
            SessionId = Guid.NewGuid(),
            Name = "Leg Day",
            Order = 1,
            Workouts =
            [
                new TrainingWorkout
                {
                    WorkoutId = Guid.NewGuid(),
                    Order = 0,
                    Name = "Main",
                    Exercises = [new SessionExercise { ExerciseId = workoutExerciseId, ExerciseName = "Squat", Order = 1 }]
                }
            ],
            StandaloneExercises = []
        };

        session.AllExercises.Should().ContainSingle().Which.ExerciseId.Should().Be(workoutExerciseId);

        var bsonDoc = session.ToBsonDocument();
        bsonDoc.Contains("allExercises").Should().BeFalse("AllExercises is [BsonIgnore] and must never be persisted");

        var deserialized = BsonSerializer.Deserialize<TrainingSession>(bsonDoc);
        deserialized.StandaloneExercises.Should().BeEmpty(
            "round-tripping through BSON must not resurrect a workout's nested exercise into StandaloneExercises");
        deserialized.AllExercises.Should().ContainSingle().Which.ExerciseId.Should().Be(workoutExerciseId);
    }
}
