using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Recipes.Shared;

/// <summary>
/// Building blocks shared by the create and update recipe endpoints: ingredient lookup with
/// visibility, nutrient totals, allergen derivation and step normalisation.
/// </summary>
public static class RecipeContent
{
    /// <summary>
    /// Loads the requested foods the caller may use: not deleted, and public or owned by the caller.
    /// Foods that are missing, deleted or another coach's private food are simply absent from the result.
    /// </summary>
    public static async Task<Dictionary<Guid, Food>> LoadUsableFoodsAsync(
        IMongoContext mongo, IEnumerable<Guid> foodIds, Guid callerId, CancellationToken ct)
    {
        var filterBuilder = Builders<Food>.Filter;

        var filter = filterBuilder.In(f => f.ExternalId, foodIds.Distinct().ToList())
            & filterBuilder.Eq(f => f.IsDeleted, false)
            & filterBuilder.Or(
                filterBuilder.Eq(f => f.Visibility, FoodVisibility.Public),
                filterBuilder.Eq(f => f.NutritionistId, callerId));

        using var cursor = await mongo.Foods.FindAsync(filter, cancellationToken: ct);
        var foods = await cursor.ToListAsync(ct);

        return foods.ToDictionary(f => f.ExternalId);
    }

    /// <summary>
    /// Builds the denormalised ingredient snapshot for a food.
    /// </summary>
    public static MealFood ToMealFood(Food food, RecipeFoodDto item) => new()
    {
        FoodExternalId = food.ExternalId,
        FoodName = food.Name,
        FoodCategory = food.Category.ToString(),
        NutrientValuePer100Grams = new NutrientValue
        {
            Kcal = food.NutrientValue.Kcal,
            Protein = food.NutrientValue.Protein,
            Carbs = food.NutrientValue.Carbs,
            Fat = food.NutrientValue.Fat,
            Fiber = food.NutrientValue.Fiber,
            Sugar = food.NutrientValue.Sugar,
            SaturatedFat = food.NutrientValue.SaturatedFat,
            Salt = food.NutrientValue.Salt
        },
        AmountGrams = item.AmountGrams,
        Note = item.Note
    };

    /// <summary>
    /// Sums the macronutrients of the whole recipe.
    /// </summary>
    public static NutrientTotals CalculateTotals(List<MealFood> foods)
    {
        var totals = new NutrientTotals();

        foreach (var food in foods)
        {
            var ratio = food.AmountGrams / 100m;
            totals.Kcal += food.NutrientValuePer100Grams.Kcal * ratio;
            totals.Protein += food.NutrientValuePer100Grams.Protein * ratio;
            totals.Carbs += food.NutrientValuePer100Grams.Carbs * ratio;
            totals.Fat += food.NutrientValuePer100Grams.Fat * ratio;
            totals.Fiber += (food.NutrientValuePer100Grams.Fiber ?? 0m) * ratio;
        }

        return totals;
    }

    /// <summary>
    /// Union of the allergens of the recipe's ingredient foods, in enum order. Ingredients with no
    /// matching food in <paramref name="foodLookup"/> contribute nothing.
    /// </summary>
    public static List<Allergen> DeriveAllergens(Recipe recipe, IReadOnlyDictionary<Guid, Food> foodLookup) =>
        recipe.Foods
            .Where(mealFood => foodLookup.ContainsKey(mealFood.FoodExternalId))
            .SelectMany(mealFood => FoodEnumListMapping.ParseStoredNames<Allergen>(foodLookup[mealFood.FoodExternalId].Allergens))
            .Distinct()
            .Order()
            .ToList();

    /// <summary>
    /// Trims each step and drops blank ones. Returns <see langword="null"/> when nothing is left.
    /// </summary>
    public static List<string>? NormalizeSteps(List<string>? steps)
    {
        var cleaned = steps?
            .Select(step => step?.Trim() ?? string.Empty)
            .Where(step => step.Length > 0)
            .ToList();

        return cleaned is { Count: > 0 } ? cleaned : null;
    }
}
