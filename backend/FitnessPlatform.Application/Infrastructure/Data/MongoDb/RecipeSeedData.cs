using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Infrastructure.Data.MongoDb;

/// <summary>
/// Seed data for the recipes collection — ~124 recipes imported from the user's Notion
/// "Receptář" database, sourced from the embedded <c>Seed/Data/seed-recipes.json</c> resource.
/// Ingredient references (by food slug) are resolved against <see cref="FoodSeedData"/> entries
/// in memory, then bound to the *actual* persisted Food <c>ExternalId</c> via the
/// name→ExternalId map <see cref="MongoSeeder"/> builds after the food phase — this correctly
/// resolves to a pre-existing legacy food's random <c>ExternalId</c> when one exists, instead of
/// dangling on the in-memory <see cref="DeterministicGuid"/> value.
/// </summary>
public static class RecipeSeedData
{
    private const string ResourceFileName = "seed-recipes.json";

    /// <summary>
    /// Builds the recipe documents to seed. All recipes are owned by the system admin account
    /// and public — see the public-catalog-seeding design spec §2/§4 for the rationale.
    /// </summary>
    /// <param name="foodNameToExternalId">
    /// Map of Food <c>Name</c> (English, case-insensitive) → the food's *actual* persisted
    /// <c>ExternalId</c>, built by <see cref="MongoSeeder"/> from the DB state after the food
    /// phase completes. On a fresh DB this equals the deterministic ID; on a DB with a
    /// pre-existing same-named legacy food, it resolves to that document's real (random) ID —
    /// see #810 review finding B1.
    /// </param>
    public static List<Recipe> GetRecipes(IReadOnlyDictionary<string, Guid> foodNameToExternalId)
    {
        var recipeEntries = LoadEntries();
        var foodEntries = FoodSeedData.LoadEntries().ToDictionary(f => f.Slug, StringComparer.Ordinal);
        var now = DateTime.UtcNow;

        var recipes = new List<Recipe>();

        foreach (var entry in recipeEntries)
        {
            var mealFoods = new List<MealFood>();

            foreach (var ingredient in entry.Ingredients)
            {
                if (!foodEntries.TryGetValue(ingredient.Slug, out var food))
                {
                    throw new InvalidOperationException(
                        $"Recipe '{entry.Slug}' references unknown food slug '{ingredient.Slug}' — " +
                        "seed-recipes.json and seed-foods.json are out of sync.");
                }

                if (!foodNameToExternalId.TryGetValue(food.NameEn, out var foodExternalId))
                {
                    throw new InvalidOperationException(
                        $"Recipe '{entry.Slug}' references food '{food.NameEn}' (slug '{food.Slug}') " +
                        "which is not present in the foods collection — foods must be seeded before recipes.");
                }

                mealFoods.Add(new MealFood
                {
                    FoodExternalId = foodExternalId,
                    FoodName = food.NameEn,
                    FoodNameCs = food.NameCs,
                    FoodNameEn = food.NameEn,
                    FoodNameDe = food.NameDe,
                    FoodCategory = food.Category,
                    NutrientValuePer100Grams = new NutrientValue
                    {
                        Kcal = food.Kcal,
                        Protein = food.Protein,
                        Carbs = food.Carbs,
                        Fat = food.Fat,
                        Fiber = food.Fiber,
                        Sugar = food.Sugar,
                        SaturatedFat = food.SaturatedFat,
                    },
                    AmountGrams = ingredient.Grams,
                    Note = ingredient.Note,
                });
            }

            recipes.Add(new Recipe
            {
                ExternalId = DeterministicGuid.Create($"recipe:{entry.Slug}"),
                NutritionistId = SystemUsers.AdminId,
                Name = entry.Name,
                Description = entry.Description,
                PrepTimeMinutes = entry.PrepMinutes,
                Steps = entry.Steps is { Count: > 0 } ? entry.Steps : null,
                Note = BuildNote(entry),
                Foods = mealFoods,
                TotalNutrients = ComputeTotals(mealFoods),
                Visibility = RecipeVisibility.Public,
                MealTypes = entry.MealTypes,
                DateCreated = now,
            });
        }

        return recipes;
    }

    /// <summary>
    /// Loads the raw seed entries. Exposed for tests that need to cross-check the source data.
    /// </summary>
    public static List<RecipeSeedEntry> LoadEntries() => SeedJsonLoader.Load<RecipeSeedEntry>(ResourceFileName, ValidateEntry);

    /// <summary>
    /// Fails fast with a clear message on a null/empty required field (the recipe's own slug/name,
    /// and every ingredient's food-slug reference) — see #810 review finding M4.
    /// </summary>
    private static void ValidateEntry(RecipeSeedEntry entry, int index)
    {
        SeedJsonLoader.RequireNonEmpty(entry.Slug, nameof(entry.Slug), ResourceFileName, index);
        SeedJsonLoader.RequireNonEmpty(entry.Name, nameof(entry.Name), ResourceFileName, index, entry.Slug);

        if (entry.Ingredients is null)
        {
            throw new InvalidOperationException(
                $"{ResourceFileName}[{index}] (slug '{entry.Slug}'): required field '{nameof(entry.Ingredients)}' is null.");
        }

        for (var i = 0; i < entry.Ingredients.Count; i++)
        {
            SeedJsonLoader.RequireNonEmpty(
                entry.Ingredients[i].Slug, $"{nameof(entry.Ingredients)}[{i}].Slug", ResourceFileName, index, entry.Slug);
        }
    }

    /// <summary>
    /// Prepends the servings-count hint (the JSON has no dedicated Recipe field for it) to the
    /// authored note. Provenance-only fields (<c>statedKcalPerServing</c>, <c>sourceUrl</c>) are
    /// intentionally not surfaced here.
    /// </summary>
    private static string? BuildNote(RecipeSeedEntry entry)
    {
        var parts = new List<string>();

        if (entry.Servings is { } servings)
        {
            parts.Add($"Recept na {servings} porcí.");
        }

        if (!string.IsNullOrWhiteSpace(entry.Note))
        {
            parts.Add(entry.Note);
        }

        return parts.Count > 0 ? string.Join(" ", parts) : null;
    }

    /// <summary>
    /// Computes whole-recipe nutrient totals from each ingredient's per-100g snapshot × grams/100
    /// — matches the rounding/aggregation semantics the app already uses elsewhere for recipes.
    /// </summary>
    private static NutrientTotals ComputeTotals(List<MealFood> mealFoods)
    {
        var totals = new NutrientTotals();

        foreach (var mf in mealFoods)
        {
            var ratio = mf.AmountGrams / 100m;
            totals.Kcal += mf.NutrientValuePer100Grams.Kcal * ratio;
            totals.Protein += mf.NutrientValuePer100Grams.Protein * ratio;
            totals.Carbs += mf.NutrientValuePer100Grams.Carbs * ratio;
            totals.Fat += mf.NutrientValuePer100Grams.Fat * ratio;
            totals.Fiber += (mf.NutrientValuePer100Grams.Fiber ?? 0) * ratio;
        }

        totals.Kcal = Math.Round(totals.Kcal, 1);
        totals.Protein = Math.Round(totals.Protein, 1);
        totals.Carbs = Math.Round(totals.Carbs, 1);
        totals.Fat = Math.Round(totals.Fat, 1);
        totals.Fiber = Math.Round(totals.Fiber, 1);

        return totals;
    }
}

/// <summary>A single recipe entry from <c>seed-recipes.json</c>.</summary>
public record RecipeSeedEntry(
    string Slug,
    string Name,
    string? Description,
    List<string>? MealTypes,
    int? PrepMinutes,
    int? Servings,
    List<string>? Steps,
    string? Note,
    List<RecipeIngredientEntry> Ingredients,
    decimal? StatedKcalPerServing,
    string? SourceUrl);

/// <summary>A single ingredient reference within a <see cref="RecipeSeedEntry"/>.</summary>
public record RecipeIngredientEntry(string Slug, decimal Grams, string? Note);
