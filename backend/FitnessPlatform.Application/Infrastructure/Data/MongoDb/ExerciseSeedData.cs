using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Infrastructure.Data.MongoDb;

/// <summary>
/// Seed data for the exercises collection — public catalog covering every
/// <see cref="ExerciseCategory"/> and muscle group, sourced from the embedded
/// <c>Seed/Data/seed-exercises.json</c> resource.
/// </summary>
public static class ExerciseSeedData
{
    private const string ResourceFileName = "seed-exercises.json";

    /// <summary>
    /// Returns the exercise documents to seed. Exercises are system catalog entries —
    /// deliberately owner-less (<c>TrainerId = null</c>, <c>IsCustom = false</c>,
    /// <c>Source = "system"</c>) so <c>/exercises/custom</c> endpoints don't misclassify catalog
    /// entries as a trainer's custom exercises.
    /// </summary>
    public static List<Exercise> GetExercises()
    {
        var now = DateTime.UtcNow;

        return LoadEntries().Select(e => new Exercise
        {
            ExternalId = DeterministicGuid.Create($"exercise:{e.Slug}"),
            Name = e.NameEn,
            LocalizedNames = new LocalizedNames
            {
                En = e.NameEn,
                Cs = e.NameCs,
                De = e.NameDe,
            },
            Description = e.Description,
            MuscleGroups = e.MuscleGroups.Select(Enum.Parse<MuscleGroup>).ToList(),
            Equipment = Enum.Parse<ExerciseEquipment>(e.Equipment),
            Category = Enum.Parse<ExerciseCategory>(e.Category),
            Difficulty = Enum.Parse<ExerciseDifficulty>(e.Difficulty),
            TechniqueNotes = e.TechniqueNotes,
            IsCustom = false,
            TrainerId = null,
            IsActive = true,
            Source = "system",
            DateCreated = now,
        }).ToList();
    }

    /// <summary>
    /// Loads the raw seed entries — exposed so <see cref="WorkoutTemplateSeedData"/> can resolve
    /// exercise slugs to denormalized names/ExternalIds without a database round trip.
    /// </summary>
    public static List<ExerciseSeedEntry> LoadEntries() => SeedJsonLoader.Load<ExerciseSeedEntry>(ResourceFileName, ValidateEntry);

    /// <summary>
    /// Fails fast with a clear message on a null/empty required field — see #810 review finding M4.
    /// </summary>
    private static void ValidateEntry(ExerciseSeedEntry entry, int index)
    {
        SeedJsonLoader.RequireNonEmpty(entry.Slug, nameof(entry.Slug), ResourceFileName, index);
        SeedJsonLoader.RequireNonEmpty(entry.NameEn, nameof(entry.NameEn), ResourceFileName, index, entry.Slug);
        SeedJsonLoader.RequireNonEmpty(entry.NameCs, nameof(entry.NameCs), ResourceFileName, index, entry.Slug);
        SeedJsonLoader.RequireNonEmpty(entry.NameDe, nameof(entry.NameDe), ResourceFileName, index, entry.Slug);
        SeedJsonLoader.RequireNonEmpty(entry.Equipment, nameof(entry.Equipment), ResourceFileName, index, entry.Slug);
        SeedJsonLoader.RequireNonEmpty(entry.Category, nameof(entry.Category), ResourceFileName, index, entry.Slug);
        SeedJsonLoader.RequireNonEmpty(entry.Difficulty, nameof(entry.Difficulty), ResourceFileName, index, entry.Slug);
    }
}

/// <summary>A single exercise entry from <c>seed-exercises.json</c>.</summary>
public record ExerciseSeedEntry(
    string Slug,
    string NameEn,
    string NameCs,
    string NameDe,
    string? Description,
    List<string> MuscleGroups,
    string Equipment,
    string Category,
    string Difficulty,
    string? TechniqueNotes);
