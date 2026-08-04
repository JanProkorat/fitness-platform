using FitnessPlatform.Application.Domain.Documents;

namespace FitnessPlatform.Application.Features.TrainingPlanTemplates.Shared;

/// <summary>
/// Maps the caller-supplied request tree (<see cref="TemplateWeekRequest"/>) onto the document
/// shapes persisted on a <see cref="TrainingPlanTemplate"/>. Shared by <c>CreateTemplate</c>
/// (when weeks are supplied directly rather than materialized from a week count) and
/// <c>UpdateTemplate</c>'s full-state replace.
/// </summary>
internal static class TemplateRequestMapper
{
    /// <summary>
    /// Maps caller-supplied weeks, minting a fresh instance id for any session, workout, or
    /// exercise that doesn't already carry one — mirrors
    /// <c>UpdateTrainingPlanEndpoint.ResolveOrMintId</c>'s pattern.
    /// </summary>
    public static List<TrainingTemplateWeek> ToWeeks(List<TemplateWeekRequest> weeks) =>
        weeks.Select(week => new TrainingTemplateWeek
        {
            WeekNumber = week.WeekNumber,
            Days = week.Days.Select(day => new TrainingDay
            {
                DayOfWeek = day.DayOfWeek,
                Note = day.Note?.Trim(),
                Sessions = day.Sessions.Select(ToSession).ToList()
            }).ToList()
        }).ToList();

    /// <summary>
    /// Materializes <paramref name="weekCount"/> empty weeks, each with all 7 <see cref="TrainingDay"/>
    /// entries and no sessions — mirrors <c>CreateTrainingPlanEndpoint.cs</c>'s empty-plan
    /// materialisation.
    /// </summary>
    public static List<TrainingTemplateWeek> ToEmptyWeeks(int weekCount) =>
        Enumerable.Range(1, weekCount).Select(weekNumber => new TrainingTemplateWeek
        {
            WeekNumber = weekNumber,
            Days = Enumerable.Range(1, 7).Select(dayOfWeek => new TrainingDay
            {
                DayOfWeek = dayOfWeek,
                Sessions = []
            }).ToList()
        }).ToList();

    private static TrainingSession ToSession(TemplateSessionRequest session) => new()
    {
        SessionId = ResolveOrMintId(session.SessionId),
        Name = session.Name,
        Order = session.Order,
        Notes = session.Notes?.Trim(),
        Format = session.Format,
        FormatConfig = session.FormatConfig,
        Workouts = session.Workouts.Select(ToWorkout).ToList(),
        StandaloneExercises = session.StandaloneExercises.Select(ToExercise).ToList()
    };

    private static TrainingWorkout ToWorkout(TemplateWorkoutRequest workout) => new()
    {
        WorkoutId = ResolveOrMintId(workout.WorkoutId),
        Order = workout.Order,
        Name = workout.Name,
        Format = workout.Format,
        FormatConfig = workout.FormatConfig,
        Notes = workout.Notes?.Trim(),
        Exercises = workout.Exercises.Select(ToExercise).ToList()
    };

    private static SessionExercise ToExercise(TemplateSessionExerciseRequest exercise) => new()
    {
        ExerciseId = ResolveOrMintId(exercise.ExerciseId),
        ExerciseExternalId = exercise.ExerciseExternalId,
        ExerciseName = exercise.ExerciseName,
        Order = exercise.Order,
        Notes = exercise.Notes?.Trim(),
        RestSeconds = exercise.RestSeconds,
        MovementType = exercise.MovementType,
        Format = exercise.Format,
        FormatConfig = exercise.FormatConfig,
        Sets = exercise.Sets.Select(ToSet).ToList()
    };

    private static ExerciseSet ToSet(TemplateExerciseSetRequest set) => new()
    {
        SetNumber = set.SetNumber,
        Type = set.Type,
        Reps = set.Reps,
        WeightKg = set.WeightKg,
        DurationSeconds = set.DurationSeconds,
        Rpe = set.Rpe,
        DistanceMeters = set.DistanceMeters,
        RestSeconds = set.RestSeconds
    };

    /// <summary>
    /// Resolves a client-supplied identifier for a session/workout/exercise instance, minting a
    /// fresh one when the request omits it (null) OR supplies an all-zero
    /// <see cref="Guid.Empty"/> — mirrors <c>UpdateTrainingPlanEndpoint.ResolveOrMintId</c>.
    /// </summary>
    private static Guid ResolveOrMintId(Guid? id) =>
        id is null || id == Guid.Empty ? Guid.NewGuid() : id.Value;
}
