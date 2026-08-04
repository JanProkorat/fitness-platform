using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.TrainingPlanTemplates.Shared;

/// <summary>
/// Deep-clones the training plan/template content tree (weeks → days → sessions → workouts/
/// standalone exercises → sets) between a <see cref="TrainingPlanTemplate"/> and a
/// <see cref="TrainingPlan"/>. <see cref="TrainingTemplateWeek.Days"/> and
/// <see cref="TrainingWeek.Days"/> share the exact same <see cref="TrainingDay"/> type, so a
/// single day-cloning routine serves every direction — the only per-direction variable is whether
/// fresh instance ids (<see cref="TrainingSession.SessionId"/>, <see cref="TrainingWorkout.WorkoutId"/>,
/// <see cref="SessionExercise.ExerciseId"/>) are minted.
/// </summary>
/// <remarks>
/// <para>
/// <b>Clone <see cref="TrainingSession.StandaloneExercises"/> only — never
/// <see cref="TrainingSession.AllExercises"/>.</b> <c>AllExercises</c> is a computed,
/// <c>[BsonIgnore]</c> flat view (<c>StandaloneExercises.Concat(Workouts.SelectMany(w =&gt;
/// w.Exercises))</c>) that republishes every workout's nested exercises alongside the standalone
/// ones. Cloning it into a fresh session's <c>StandaloneExercises</c> would silently duplicate
/// every nested workout exercise — the workout keeps its own copy via <see cref="CloneWorkout"/>,
/// and the flat view's copy would land in the standalone list too. <see cref="CloneSession"/>
/// below reads <see cref="TrainingSession.StandaloneExercises"/> explicitly for exactly this
/// reason; <see cref="TrainingWorkout.Exercises"/> is a distinct, legitimate member cloned
/// separately by <see cref="CloneWorkout"/>.
/// </para>
/// <para>
/// <b>Fresh ids on the from-plan and instantiate directions.</b> The training tree carries ids
/// the actuals collections join on: <see cref="TrainingSession.SessionId"/>,
/// <see cref="TrainingWorkout.WorkoutId"/>, and <see cref="SessionExercise.ExerciseId"/>.
/// <see cref="CloneWeeksAsPlan"/> (instantiate) and <see cref="CloneWeeksFromPlan"/> (from-plan)
/// both mint fresh ids — instantiating the same template for two different clients must never let
/// their <see cref="SessionExecution"/>/<see cref="SessionLock"/> records collide, and from-plan
/// mints fresh ids too as defence in depth (a stored template must never alias a live plan's ids).
/// <see cref="CloneWeeksAsTemplate"/> (template → template <c>copy</c>) carries ids over verbatim
/// — two independent templates are never resolved by these ids, and any future <c>instantiate</c>
/// of either copy mints its own fresh ids regardless of what the template holds.
/// </para>
/// </remarks>
internal static class TemplateContentCloner
{
    /// <summary>
    /// Clones a template's own week tree into a fresh, independent week tree for a new template
    /// (the <c>copy</c> endpoint). Ids are carried over verbatim.
    /// </summary>
    public static List<TrainingTemplateWeek> CloneWeeksAsTemplate(List<TrainingTemplateWeek> source) =>
        source.Select(week => new TrainingTemplateWeek
        {
            WeekNumber = week.WeekNumber,
            Days = CloneDays(week.Days, mintFreshIds: false)
        }).ToList();

    /// <summary>
    /// Clones an existing plan's week tree into a template's slim week shape (the
    /// <c>from-plan</c> endpoint). Mints fresh <see cref="TrainingSession.SessionId"/>/
    /// <see cref="TrainingWorkout.WorkoutId"/>/<see cref="SessionExercise.ExerciseId"/> values —
    /// defence in depth so a stored template never aliases the source plan's ids.
    /// </summary>
    public static List<TrainingTemplateWeek> CloneWeeksFromPlan(List<TrainingWeek> source) =>
        source.Select(week => new TrainingTemplateWeek
        {
            WeekNumber = week.WeekNumber,
            Days = CloneDays(week.Days, mintFreshIds: true)
        }).ToList();

    /// <summary>
    /// Clones a template's week tree into a brand-new client plan's week tree (the
    /// <c>instantiate</c> endpoint). Every week is materialized <see cref="WeekStatus.Draft"/>,
    /// and every session/workout/exercise instance id is freshly minted — see this type's class
    /// remarks for why that is required.
    /// </summary>
    public static List<TrainingWeek> CloneWeeksAsPlan(List<TrainingTemplateWeek> source) =>
        source.Select(week => new TrainingWeek
        {
            WeekNumber = week.WeekNumber,
            Status = WeekStatus.Draft,
            Days = CloneDays(week.Days, mintFreshIds: true)
        }).ToList();

    private static List<TrainingDay> CloneDays(List<TrainingDay> source, bool mintFreshIds) =>
        source.Select(day => new TrainingDay
        {
            DayOfWeek = day.DayOfWeek,
            Note = day.Note,
            Sessions = day.Sessions.Select(session => CloneSession(session, mintFreshIds)).ToList()
        }).ToList();

    private static TrainingSession CloneSession(TrainingSession session, bool mintFreshIds) => new()
    {
        SessionId = mintFreshIds ? Guid.NewGuid() : session.SessionId,
        Name = session.Name,
        Order = session.Order,
        Notes = session.Notes,
        Format = session.Format,
        FormatConfig = session.FormatConfig,
        Workouts = session.Workouts.Select(workout => CloneWorkout(workout, mintFreshIds)).ToList(),
        // Clone the persisted StandaloneExercises list ONLY — never the computed AllExercises
        // flat view. See this type's class remarks.
        StandaloneExercises = session.StandaloneExercises.Select(exercise => CloneExercise(exercise, mintFreshIds)).ToList()
    };

    private static TrainingWorkout CloneWorkout(TrainingWorkout workout, bool mintFreshIds) => new()
    {
        WorkoutId = mintFreshIds ? Guid.NewGuid() : workout.WorkoutId,
        Order = workout.Order,
        Name = workout.Name,
        Format = workout.Format,
        FormatConfig = workout.FormatConfig,
        Notes = workout.Notes,
        Exercises = workout.Exercises.Select(exercise => CloneExercise(exercise, mintFreshIds)).ToList()
    };

    private static SessionExercise CloneExercise(SessionExercise exercise, bool mintFreshIds) => new()
    {
        ExerciseId = mintFreshIds ? Guid.NewGuid() : exercise.ExerciseId,
        ExerciseExternalId = exercise.ExerciseExternalId,
        ExerciseName = exercise.ExerciseName,
        Order = exercise.Order,
        Notes = exercise.Notes,
        RestSeconds = exercise.RestSeconds,
        MovementType = exercise.MovementType,
        Format = exercise.Format,
        FormatConfig = exercise.FormatConfig,
        Sets = exercise.Sets.Select(CloneSet).ToList()
    };

    private static ExerciseSet CloneSet(ExerciseSet set) => new()
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
}
