using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Infrastructure.Data.MongoDb;

/// <summary>
/// Seed data for the workoutTemplates collection — at least two templates per
/// <see cref="WorkoutFormat"/> value, sourced from the embedded
/// <c>Seed/Data/seed-workout-templates.json</c> resource. Exercise references (by slug) are
/// resolved against <see cref="ExerciseSeedData"/> entries directly in memory.
/// </summary>
public static class WorkoutTemplateSeedData
{
    private const string ResourceFileName = "seed-workout-templates.json";

    /// <summary>
    /// Builds the workout template documents to seed. All templates are owned by the system
    /// admin account and public — see the public-catalog-seeding design spec §5 for the rationale.
    /// </summary>
    public static List<WorkoutTemplate> GetWorkoutTemplates()
    {
        var entries = LoadEntries();
        var exerciseEntries = ExerciseSeedData.LoadEntries().ToDictionary(e => e.Slug, StringComparer.Ordinal);
        var now = DateTime.UtcNow;

        var templates = new List<WorkoutTemplate>();

        foreach (var entry in entries)
        {
            var sections = entry.Sections.Select(section => new TrainingSection
            {
                SectionId = Guid.NewGuid(),
                // seed-workout-templates.json authors sections with 1-based order;
                // TrainingSection.Order is documented as 0-based.
                Order = section.Order - 1,
                Name = section.Name,
                Format = ParseNullableEnum<WorkoutFormat>(section.Format),
                FormatConfig = MapWodConfig(section.FormatConfig),
                Notes = section.Notes,
                Exercises = section.Exercises.Select(exerciseRef =>
                {
                    if (!exerciseEntries.TryGetValue(exerciseRef.ExerciseSlug, out var exercise))
                    {
                        throw new InvalidOperationException(
                            $"Workout template '{entry.Slug}' references unknown exercise slug " +
                            $"'{exerciseRef.ExerciseSlug}' — seed-workout-templates.json and " +
                            "seed-exercises.json are out of sync.");
                    }

                    return new SessionExercise
                    {
                        ExerciseExternalId = DeterministicGuid.Create($"exercise:{exercise.Slug}"),
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

            templates.Add(new WorkoutTemplate
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
                Sections = sections,
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
    public static List<WorkoutTemplateSeedEntry> LoadEntries() =>
        SeedJsonLoader.Load<WorkoutTemplateSeedEntry>(ResourceFileName);

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

/// <summary>A single workout template entry from <c>seed-workout-templates.json</c>.</summary>
public record WorkoutTemplateSeedEntry(
    string Slug,
    string NameEn,
    string NameCs,
    string NameDe,
    string? Description,
    string Difficulty,
    int? EstimatedDurationMinutes,
    string Format,
    WodConfigSeedEntry? FormatConfig,
    List<WorkoutTemplateSectionEntry> Sections);

/// <summary>WOD format configuration, as authored in the JSON — mirrors <see cref="WodConfig"/>.</summary>
public record WodConfigSeedEntry(
    int? TimeCapSeconds,
    int? IntervalSeconds,
    int? TotalRounds,
    int? WorkSeconds,
    int? RestSeconds);

/// <summary>A single section within a <see cref="WorkoutTemplateSeedEntry"/>.</summary>
public record WorkoutTemplateSectionEntry(
    string Name,
    int Order,
    string? Format,
    WodConfigSeedEntry? FormatConfig,
    string? Notes,
    List<WorkoutTemplateExerciseEntry> Exercises);

/// <summary>A single exercise reference within a <see cref="WorkoutTemplateSectionEntry"/>.</summary>
public record WorkoutTemplateExerciseEntry(
    string ExerciseSlug,
    int Order,
    int? RestSeconds,
    string MovementType,
    string? Notes,
    List<WorkoutTemplateSetEntry> Sets);

/// <summary>A single prescribed set within a <see cref="WorkoutTemplateExerciseEntry"/>.</summary>
public record WorkoutTemplateSetEntry(
    int SetNumber,
    string Type,
    int? Reps,
    decimal? WeightKg,
    int? DurationSeconds,
    decimal? DistanceMeters,
    int? RestSeconds);
