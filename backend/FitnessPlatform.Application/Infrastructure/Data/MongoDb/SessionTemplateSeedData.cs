using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Infrastructure.Data.MongoDb;

/// <summary>
/// Seed data for the sessionTemplates collection — at least two templates per
/// <see cref="WorkoutFormat"/> value, sourced from the embedded
/// <c>Seed/Data/seed-session-templates.json</c> resource. Exercise references (by slug) are
/// resolved against <see cref="ExerciseSeedData"/> entries in memory, then bound to the *actual*
/// persisted Exercise <c>ExternalId</c> via the name→ExternalId map <see cref="MongoSeeder"/>
/// builds after the exercise phase — see #810 review finding B1.
/// </summary>
public static class SessionTemplateSeedData
{
    private const string ResourceFileName = "seed-session-templates.json";

    /// <summary>
    /// Builds the workout template documents to seed. All templates are owned by the system
    /// admin account and public — see the public-catalog-seeding design spec §5 for the rationale.
    /// </summary>
    /// <param name="exerciseNameToExternalId">
    /// Map of Exercise <c>Name</c> (English, case-insensitive) → the exercise's *actual* persisted
    /// <c>ExternalId</c>, built by <see cref="MongoSeeder"/> from the DB state after the exercise
    /// phase completes. On a fresh DB this equals the deterministic ID; on a DB with a
    /// pre-existing same-named legacy exercise, it resolves to that document's real (random) ID.
    /// </param>
    public static List<SessionTemplate> GetSessionTemplates(IReadOnlyDictionary<string, Guid> exerciseNameToExternalId)
    {
        var entries = LoadEntries();
        var exerciseEntries = ExerciseSeedData.LoadEntries().ToDictionary(e => e.Slug, StringComparer.Ordinal);
        var now = DateTime.UtcNow;

        var templates = new List<SessionTemplate>();

        foreach (var entry in entries)
        {
            var workouts = entry.Workouts.Select(workoutEntry => new TrainingWorkout
            {
                WorkoutId = Guid.NewGuid(),
                // seed-session-templates.json authors workouts with 1-based order;
                // TrainingWorkout.Order is documented as 0-based.
                Order = workoutEntry.Order - 1,
                Name = workoutEntry.Name,
                Format = ParseNullableEnum<WorkoutFormat>(workoutEntry.Format),
                FormatConfig = MapWodConfig(workoutEntry.FormatConfig),
                Notes = workoutEntry.Notes,
                Exercises = workoutEntry.Exercises.Select(exerciseRef =>
                {
                    if (!exerciseEntries.TryGetValue(exerciseRef.ExerciseSlug, out var exercise))
                    {
                        throw new InvalidOperationException(
                            $"Workout template '{entry.Slug}' references unknown exercise slug " +
                            $"'{exerciseRef.ExerciseSlug}' — seed-session-templates.json and " +
                            "seed-exercises.json are out of sync.");
                    }

                    if (!exerciseNameToExternalId.TryGetValue(exercise.NameEn, out var exerciseExternalId))
                    {
                        throw new InvalidOperationException(
                            $"Workout template '{entry.Slug}' references exercise '{exercise.NameEn}' " +
                            $"(slug '{exercise.Slug}') which is not present in the exercises collection " +
                            "— exercises must be seeded before workout templates.");
                    }

                    return new SessionExercise
                    {
                        ExerciseExternalId = exerciseExternalId,
                        ExerciseName = exercise.NameEn,
                        // SessionExercise.Order is documented as 1-based — matches the JSON as-is.
                        Order = exerciseRef.Order,
                        Notes = exerciseRef.Notes,
                        RestSeconds = exerciseRef.RestSeconds,
                        MovementType = Enum.Parse<MovementType>(exerciseRef.MovementType),
                        Sets = exerciseRef.Sets.Select(set => new ExerciseSet
                        {
                            SetNumber = set.SetNumber,
                            Type = Enum.Parse<SetType>(set.Type),
                            Reps = set.Reps,
                            WeightKg = set.WeightKg,
                            DurationSeconds = set.DurationSeconds,
                            DistanceMeters = set.DistanceMeters,
                            RestSeconds = set.RestSeconds,
                        }).ToList(),
                    };
                }).ToList(),
            }).ToList();

            templates.Add(new SessionTemplate
            {
                ExternalId = DeterministicGuid.Create($"workoutTemplate:{entry.Slug}"),
                OwnerId = SystemUsers.AdminId,
                Name = entry.NameEn,
                LocalizedNames = new LocalizedNames
                {
                    En = entry.NameEn,
                    Cs = entry.NameCs,
                    De = entry.NameDe,
                },
                Description = entry.Description,
                Difficulty = Enum.Parse<ExerciseDifficulty>(entry.Difficulty),
                EstimatedDurationMinutes = entry.EstimatedDurationMinutes,
                Format = Enum.Parse<WorkoutFormat>(entry.Format),
                FormatConfig = MapWodConfig(entry.FormatConfig),
                Workouts = workouts,
                Visibility = WorkoutTemplateVisibility.Public,
                Version = 1,
                DateCreated = now,
            });
        }

        return templates;
    }

    /// <summary>
    /// Loads the raw seed entries. Exposed for tests that need to cross-check the source data.
    /// </summary>
    public static List<SessionTemplateSeedEntry> LoadEntries() =>
        SeedJsonLoader.Load<SessionTemplateSeedEntry>(ResourceFileName, ValidateEntry);

    /// <summary>
    /// Fails fast with a clear message on a null/empty required field — the template's own
    /// slug/names, plus every workout name and exercise-slug/movement-type reference, since a
    /// null exercise slug would otherwise silently dangle rather than throw — see #810 review
    /// finding M4.
    /// </summary>
    private static void ValidateEntry(SessionTemplateSeedEntry entry, int index)
    {
        SeedJsonLoader.RequireNonEmpty(entry.Slug, nameof(entry.Slug), ResourceFileName, index);
        SeedJsonLoader.RequireNonEmpty(entry.NameEn, nameof(entry.NameEn), ResourceFileName, index, entry.Slug);
        SeedJsonLoader.RequireNonEmpty(entry.NameCs, nameof(entry.NameCs), ResourceFileName, index, entry.Slug);
        SeedJsonLoader.RequireNonEmpty(entry.NameDe, nameof(entry.NameDe), ResourceFileName, index, entry.Slug);
        SeedJsonLoader.RequireNonEmpty(entry.Difficulty, nameof(entry.Difficulty), ResourceFileName, index, entry.Slug);
        SeedJsonLoader.RequireNonEmpty(entry.Format, nameof(entry.Format), ResourceFileName, index, entry.Slug);

        if (entry.Workouts is null)
        {
            throw new InvalidOperationException(
                $"{ResourceFileName}[{index}] (slug '{entry.Slug}'): required field '{nameof(entry.Workouts)}' is null.");
        }

        for (var w = 0; w < entry.Workouts.Count; w++)
        {
            var workout = entry.Workouts[w];
            SeedJsonLoader.RequireNonEmpty(
                workout.Name, $"{nameof(entry.Workouts)}[{w}].Name", ResourceFileName, index, entry.Slug);

            if (workout.Exercises is null)
            {
                throw new InvalidOperationException(
                    $"{ResourceFileName}[{index}] (slug '{entry.Slug}'): required field " +
                    $"'{nameof(entry.Workouts)}[{w}].{nameof(workout.Exercises)}' is null.");
            }

            for (var e = 0; e < workout.Exercises.Count; e++)
            {
                var exerciseRef = workout.Exercises[e];
                var fieldPrefix = $"{nameof(entry.Workouts)}[{w}].{nameof(workout.Exercises)}[{e}]";
                SeedJsonLoader.RequireNonEmpty(
                    exerciseRef.ExerciseSlug, $"{fieldPrefix}.{nameof(exerciseRef.ExerciseSlug)}", ResourceFileName, index, entry.Slug);
                SeedJsonLoader.RequireNonEmpty(
                    exerciseRef.MovementType, $"{fieldPrefix}.{nameof(exerciseRef.MovementType)}", ResourceFileName, index, entry.Slug);
            }
        }
    }

    private static T? ParseNullableEnum<T>(string? value) where T : struct, Enum =>
        value is null ? null : Enum.Parse<T>(value);

    private static WodConfig? MapWodConfig(WodConfigSeedEntry? entry) =>
        entry is null
            ? null
            : new WodConfig
            {
                TimeCapSeconds = entry.TimeCapSeconds,
                IntervalSeconds = entry.IntervalSeconds,
                TotalRounds = entry.TotalRounds,
                WorkSeconds = entry.WorkSeconds,
                RestSeconds = entry.RestSeconds,
            };
}

/// <summary>A single session template entry from <c>seed-session-templates.json</c>.</summary>
public record SessionTemplateSeedEntry(
    string Slug,
    string NameEn,
    string NameCs,
    string NameDe,
    string? Description,
    string Difficulty,
    int? EstimatedDurationMinutes,
    string Format,
    WodConfigSeedEntry? FormatConfig,
    List<SessionTemplateWorkoutEntry> Workouts);

/// <summary>WOD format configuration, as authored in the JSON — mirrors <see cref="WodConfig"/>.</summary>
public record WodConfigSeedEntry(
    int? TimeCapSeconds,
    int? IntervalSeconds,
    int? TotalRounds,
    int? WorkSeconds,
    int? RestSeconds);

/// <summary>A single workout within a <see cref="SessionTemplateSeedEntry"/>.</summary>
public record SessionTemplateWorkoutEntry(
    string Name,
    int Order,
    string? Format,
    WodConfigSeedEntry? FormatConfig,
    string? Notes,
    List<SessionTemplateExerciseEntry> Exercises);

/// <summary>A single exercise reference within a <see cref="SessionTemplateWorkoutEntry"/>.</summary>
public record SessionTemplateExerciseEntry(
    string ExerciseSlug,
    int Order,
    int? RestSeconds,
    string MovementType,
    string? Notes,
    List<SessionTemplateSetEntry> Sets);

/// <summary>A single prescribed set within a <see cref="SessionTemplateExerciseEntry"/>.</summary>
public record SessionTemplateSetEntry(
    int SetNumber,
    string Type,
    int? Reps,
    decimal? WeightKg,
    int? DurationSeconds,
    decimal? DistanceMeters,
    int? RestSeconds);
