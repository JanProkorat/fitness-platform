using FluentAssertions;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;

namespace FitnessPlatform.Tests.Seeding;

/// <summary>
/// Plain unit tests (no Testcontainers) for seeded dietary preferences: foods carry the tags
/// authored in <c>seed-foods.json</c>, and a seeded recipe carries only the tags every ingredient has.
/// </summary>
public class SeedDietaryPreferencesTests
{
    private static string[] FoodTags(string slug) =>
        FoodSeedData.GetFoods()
            .Single(f => f.ExternalId == DeterministicGuid.Create($"food:{slug}"))
            .DietaryPreferences.ToArray();

    /// <summary>Foods copy their authored tags; each row is one distinct derivation branch.</summary>
    [Theory]
    [InlineData("banana", new[] { "Vegan", "Vegetarian", "Pescatarian", "GlutenFree", "LactoseFree" })]
    [InlineData("oats-rolled-dry", new[] { "Vegan", "Vegetarian", "Pescatarian", "LactoseFree" })]
    [InlineData("whole-egg", new[] { "Vegetarian", "Pescatarian", "GlutenFree", "LactoseFree" })]
    [InlineData("mozzarella", new[] { "Vegetarian", "Pescatarian", "GlutenFree" })]
    [InlineData("salmon-fillet-raw", new[] { "Pescatarian", "GlutenFree", "LactoseFree" })]
    [InlineData("chicken-breast-raw", new string[0])]
    [InlineData("sugar", new string[0])]
    public void GetFoods_AuthoredFood_CopiesDietaryPreferences(string slug, string[] expected)
    {
        FoodTags(slug).Should().BeEquivalentTo(expected);
    }

    /// <summary>Every stored tag name must be a real <see cref="DietaryPreference"/>.</summary>
    [Fact]
    public void LoadEntries_EveryFoodTag_IsADietaryPreferenceName()
    {
        var entries = FoodSeedData.LoadEntries();

        entries.Should().AllSatisfy(entry =>
            (entry.DietaryPreferences ?? []).Should().OnlyContain(
                tag => Enum.IsDefined(typeof(DietaryPreference), tag),
                $"seeded food '{entry.Slug}' has an unknown dietary preference"));
    }

    /// <summary>The recipe tag set is the intersection of the ingredient tag sets.</summary>
    [Theory]
    [InlineData(new[] { "Vegan,Vegetarian", "Vegan,Vegetarian" }, new[] { "Vegan", "Vegetarian" })]
    [InlineData(new[] { "Vegan,Vegetarian", "Vegetarian" }, new[] { "Vegetarian" })]
    [InlineData(new[] { "Vegan", "GlutenFree" }, new string[0])]
    [InlineData(new[] { "Vegan", "" }, new string[0])]
    public void IntersectDietaryPreferences_Ingredients_ReturnsSharedTagsOnly(string[] ingredientTags, string[] expected)
    {
        var ingredients = ingredientTags
            .Select(tags => tags.Length == 0 ? new List<string>() : tags.Split(',').ToList());

        RecipeSeedData.IntersectDietaryPreferences(ingredients).Should().BeEquivalentTo(expected);
    }

    /// <summary>An ingredient that could not be resolved (no tag list) clears every preference.</summary>
    [Fact]
    public void IntersectDietaryPreferences_UnresolvableIngredient_ReturnsNone()
    {
        var ingredients = new List<List<string>?> { new() { "Vegan" }, null };

        RecipeSeedData.IntersectDietaryPreferences(ingredients).Should().BeEmpty();
    }

    /// <summary>A recipe without ingredients has nothing to vouch for any preference.</summary>
    [Fact]
    public void IntersectDietaryPreferences_NoIngredients_ReturnsNone()
    {
        RecipeSeedData.IntersectDietaryPreferences([]).Should().BeEmpty();
    }

    /// <summary>
    /// The seeded recipes get tags end to end: a plant-only recipe is Vegan, a recipe with a
    /// non-vegan ingredient is not, and a non-trivial number of recipes carry at least one tag.
    /// </summary>
    [Fact]
    public void GetRecipes_SeededCatalog_DerivesTagsFromIngredients()
    {
        var foodsByName = FoodSeedData.GetFoods().ToDictionary(f => f.Name, f => f.ExternalId, StringComparer.OrdinalIgnoreCase);
        var foodsBySlug = FoodSeedData.LoadEntries().ToDictionary(f => f.Slug);
        var recipeEntries = RecipeSeedData.LoadEntries().ToDictionary(r => r.Slug);

        var recipes = RecipeSeedData.GetRecipes(foodsByName);

        recipes.Count(r => r.DietaryPreferences.Count > 0).Should().BeGreaterThan(20);

        foreach (var recipe in recipes)
        {
            var entry = recipeEntries.Values.Single(e => DeterministicGuid.Create($"recipe:{e.Slug}") == recipe.ExternalId);
            var allVegan = entry.Ingredients.All(i => (foodsBySlug[i.Slug].DietaryPreferences ?? []).Contains("Vegan"));

            recipe.DietaryPreferences.Contains("Vegan").Should().Be(allVegan, $"recipe '{entry.Slug}'");
        }

        recipes.Should().Contain(r => r.DietaryPreferences.Contains("Vegan"));
        recipes.Should().Contain(r => !r.DietaryPreferences.Contains("Vegan"));
    }
}
