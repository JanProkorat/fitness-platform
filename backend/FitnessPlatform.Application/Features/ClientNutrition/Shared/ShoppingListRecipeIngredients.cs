using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.ClientNutrition.Shared;

/// <summary>
/// The one rule for which recipe ingredients land on a week's shopping list, shared by the list read
/// and the tick write so both agree on what is on the list.
/// </summary>
internal static class ShoppingListRecipeIngredients
{
    /// <summary>
    /// Expands the recipes of the given weeks into ingredient entries scaled to the planned servings.
    /// Recipes that no longer exist are skipped.
    /// </summary>
    public static async Task<List<(int WeekNumber, MealFood Food)>> LoadAsync(
        IMongoContext mongo, IEnumerable<PlanWeek> weeks, CancellationToken ct)
    {
        var mealRecipes = weeks
            .SelectMany(w => w.Days.SelectMany(d => d.Meals).SelectMany(m => m.Recipes).Select(r => (w.WeekNumber, MealRecipe: r)))
            .ToList();

        if (mealRecipes.Count == 0)
        {
            return [];
        }

        var recipeIds = mealRecipes.Select(r => r.MealRecipe.RecipeId).Distinct().ToList();

        using var cursor = await mongo.Recipes.FindAsync(
            Builders<Recipe>.Filter.In(r => r.ExternalId, recipeIds), cancellationToken: ct);
        var recipesById = (await cursor.ToListAsync(ct)).ToDictionary(r => r.ExternalId);

        var ingredients = new List<(int WeekNumber, MealFood Food)>();

        foreach (var (weekNumber, mealRecipe) in mealRecipes)
        {
            if (!recipesById.TryGetValue(mealRecipe.RecipeId, out var recipe))
            {
                continue;
            }

            // Recipe.Foods hold whole-recipe amounts; Servings is the recipe's yield.
            var factor = mealRecipe.Servings / Math.Max(recipe.Servings, 1);

            ingredients.AddRange(recipe.Foods.Select(food => (weekNumber, new MealFood
            {
                FoodExternalId = food.FoodExternalId,
                FoodName = food.FoodName,
                FoodNameCs = food.FoodNameCs,
                FoodNameEn = food.FoodNameEn,
                FoodNameDe = food.FoodNameDe,
                FoodCategory = food.FoodCategory,
                AmountGrams = food.AmountGrams * factor,
            })));
        }

        return ingredients;
    }
}
