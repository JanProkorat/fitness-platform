using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Infrastructure.Data.MongoDb;

/// <summary>
/// Seed data for the foods collection — public catalog covering every ingredient used by the
/// seeded recipes, sourced from the embedded <c>Seed/Data/seed-foods.json</c> resource.
/// </summary>
public static class FoodSeedData
{
    private const string ResourceFileName = "seed-foods.json";

    /// <summary>
    /// Returns the food documents to seed. Foods are system catalog entries — deliberately
    /// owner-less (<c>NutritionistId = null</c>) so <c>/foods/custom</c> endpoints (which filter
    /// by owner) don't misclassify catalog entries as a nutritionist's custom foods.
    /// </summary>
    public static List<Food> GetFoods()
    {
        var now = DateTime.UtcNow;

        return LoadEntries().Select(e => new Food
        {
            ExternalId = DeterministicGuid.Create($"food:{e.Slug}"),
            Name = e.NameEn,
            LocalizedNames = new LocalizedNames
            {
                En = e.NameEn,
                Cs = e.NameCs,
                De = e.NameDe,
            },
            Category = Enum.Parse<FoodCategory>(e.Category),
            NutrientValue = new NutrientValue
            {
                Kcal = e.Kcal,
                Protein = e.Protein,
                Carbs = e.Carbs,
                Fat = e.Fat,
                Fiber = e.Fiber,
                Sugar = e.Sugar,
                SaturatedFat = e.SaturatedFat,
            },
            CommonServings = e.Servings?
                .Select(s => new ServingSize { Label = s.Label, WeightGrams = s.Grams })
                .ToList() ?? [],
            Allergens = e.Allergens ?? [],
            NutritionistId = null,
            Visibility = FoodVisibility.Public,
            DateCreated = now,
        }).ToList();
    }

    /// <summary>
    /// Loads the raw seed entries — exposed so <see cref="RecipeSeedData"/> can resolve
    /// ingredient slugs to per-100g nutrient snapshots without a database round trip.
    /// </summary>
    public static List<FoodSeedEntry> LoadEntries() => SeedJsonLoader.Load<FoodSeedEntry>(ResourceFileName, ValidateEntry);

    /// <summary>
    /// Fails fast with a clear message on a null/empty required field, instead of letting it
    /// surface as an NRE deep in the seeding pipeline (e.g. a null <c>Slug</c> silently
    /// interpolating to an empty string in <see cref="DeterministicGuid.Create"/>).
    /// </summary>
    private static void ValidateEntry(FoodSeedEntry entry, int index)
    {
        SeedJsonLoader.RequireNonEmpty(entry.Slug, nameof(entry.Slug), ResourceFileName, index);
        SeedJsonLoader.RequireNonEmpty(entry.NameEn, nameof(entry.NameEn), ResourceFileName, index, entry.Slug);
        SeedJsonLoader.RequireNonEmpty(entry.NameCs, nameof(entry.NameCs), ResourceFileName, index, entry.Slug);
        SeedJsonLoader.RequireNonEmpty(entry.NameDe, nameof(entry.NameDe), ResourceFileName, index, entry.Slug);
        SeedJsonLoader.RequireNonEmpty(entry.Category, nameof(entry.Category), ResourceFileName, index, entry.Slug);
    }
}

/// <summary>A single food entry from <c>seed-foods.json</c>.</summary>
public record FoodSeedEntry(
    string Slug,
    string NameEn,
    string NameCs,
    string NameDe,
    string Category,
    decimal Kcal,
    decimal Protein,
    decimal Carbs,
    decimal Fat,
    decimal? Fiber,
    decimal? Sugar,
    decimal? SaturatedFat,
    List<string>? Allergens,
    List<FoodServingEntry>? Servings);

/// <summary>A common serving size entry for a food, as authored in <c>seed-foods.json</c>.</summary>
public record FoodServingEntry(string Label, decimal Grams);
