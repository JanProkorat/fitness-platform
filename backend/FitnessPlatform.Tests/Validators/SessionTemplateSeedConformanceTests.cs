using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.SessionTemplates.UpdateSessionTemplate;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Guards against a future <c>seed-session-templates.json</c> entry that seeds cleanly (the
/// MongoDB seeder writes documents directly, bypassing the validator) but then becomes
/// permanently unsaveable the moment a coach opens it in the editor and hits Save — because
/// <see cref="UpdateSessionTemplateValidator"/> now enforces the same seven rule families
/// (#892) the plan write path always has. Runs every entry in
/// <c>Seed/Data/seed-session-templates.json</c> through the real update validator, exactly as a
/// no-op "open and save" from the coach UI would.
/// </summary>
/// <remarks>
/// Exercise references in the JSON are by slug, not by a resolved catalog <c>ExternalId</c> — this
/// test assigns each exercise reference a fresh, non-empty <see cref="Guid"/> rather than resolving
/// against <see cref="ExerciseSeedData"/>, since the validator only checks
/// <c>ExerciseExternalId</c> for non-emptiness, never that it resolves to a real exercise.
/// </remarks>
public class SessionTemplateSeedConformanceTests
{
    public static IEnumerable<object[]> SeedEntries() =>
        SessionTemplateSeedData.LoadEntries().Select(entry => new object[] { entry });

    [Theory]
    [MemberData(nameof(SeedEntries))]
    public void SeedEntry_ThroughUpdateValidator_IsValid(SessionTemplateSeedEntry entry)
    {
        var request = ToUpdateRequest(entry);

        var result = new UpdateSessionTemplateValidator().TestValidate(request);

        result.IsValid.Should().BeTrue(
            $"seed entry '{entry.Slug}' must stay saveable through UpdateSessionTemplate once a coach opens and re-saves it; " +
            $"errors: {string.Join("; ", result.Errors.Select(e => $"{e.PropertyName}:{e.ErrorCode}:{e.ErrorMessage}"))}");
    }

    private static UpdateSessionTemplateRequest ToUpdateRequest(SessionTemplateSeedEntry entry) => new()
    {
        TemplateId = Guid.NewGuid(),
        Name = entry.NameEn,
        Description = entry.Description,
        Difficulty = Enum.Parse<ExerciseDifficulty>(entry.Difficulty),
        EstimatedDurationMinutes = entry.EstimatedDurationMinutes,
        Format = Enum.Parse<WorkoutFormat>(entry.Format),
        FormatConfig = ToWodConfig(entry.FormatConfig),
        Workouts = entry.Workouts.Select(ToWorkout).ToList(),
        StandaloneExercises = [],
        Visibility = LibraryVisibility.Public,
        Version = 1
    };

    private static TrainingWorkout ToWorkout(SessionTemplateWorkoutEntry workout) => new()
    {
        WorkoutId = Guid.NewGuid(),
        // seed-session-templates.json authors workouts with 1-based order; TrainingWorkout.Order
        // is documented 0-based — mirrors SessionTemplateSeedData.GetSessionTemplates exactly.
        Order = workout.Order - 1,
        Name = workout.Name,
        Format = workout.Format is null ? null : Enum.Parse<WorkoutFormat>(workout.Format),
        FormatConfig = ToWodConfig(workout.FormatConfig),
        Notes = workout.Notes,
        Exercises = workout.Exercises.Select(ToExercise).ToList()
    };

    private static SessionExercise ToExercise(SessionTemplateExerciseEntry exercise) => new()
    {
        ExerciseExternalId = Guid.NewGuid(),
        ExerciseName = exercise.ExerciseSlug,
        Order = exercise.Order,
        Notes = exercise.Notes,
        RestSeconds = exercise.RestSeconds,
        MovementType = Enum.Parse<MovementType>(exercise.MovementType),
        Sets = exercise.Sets.Select(ToSet).ToList()
    };

    private static ExerciseSet ToSet(SessionTemplateSetEntry set) => new()
    {
        SetNumber = set.SetNumber,
        Type = Enum.Parse<SetType>(set.Type),
        Reps = set.Reps,
        WeightKg = set.WeightKg,
        DurationSeconds = set.DurationSeconds,
        DistanceMeters = set.DistanceMeters,
        RestSeconds = set.RestSeconds
    };

    private static WodConfig? ToWodConfig(WodConfigSeedEntry? entry) =>
        entry is null
            ? null
            : new WodConfig
            {
                TimeCapSeconds = entry.TimeCapSeconds,
                IntervalSeconds = entry.IntervalSeconds,
                TotalRounds = entry.TotalRounds,
                WorkSeconds = entry.WorkSeconds,
                RestSeconds = entry.RestSeconds
            };
}
