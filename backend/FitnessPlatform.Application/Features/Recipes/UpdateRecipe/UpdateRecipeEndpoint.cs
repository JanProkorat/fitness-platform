using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Features.Recipes.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Recipes.UpdateRecipe;

/// <summary>
/// Updates an existing recipe with new food data and recalculated nutrient totals.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class UpdateRecipeEndpoint(IMongoContext mongo)
    : Endpoint<UpdateRecipeRequest, GetRecipeResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Put("/recipes/{RecipeId}");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Update recipe";
            s.Description = "Updates an existing recipe's name, description, and food items.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(UpdateRecipeRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

        // Find existing recipe owned by this nutritionist
        var filter = Builders<Recipe>.Filter.Eq(r => r.ExternalId, req.RecipeId)
            & Builders<Recipe>.Filter.Eq(r => r.NutritionistId, nutritionistId);

        using var recipeCursor = await mongo.Recipes.FindAsync(filter, cancellationToken: ct);
        var recipe = await recipeCursor.FirstOrDefaultAsync(ct);

        if (recipe is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }

        // Look up all referenced foods
        var foodExternalIds = req.Foods.Select(f => f.FoodExternalId).Distinct().ToList();
        var foodFilter = Builders<Food>.Filter.In(f => f.ExternalId, foodExternalIds);
        using var foodCursor = await mongo.Foods.FindAsync(foodFilter, cancellationToken: ct);
        var foods = await foodCursor.ToListAsync(ct);
        var foodLookup = foods.ToDictionary(f => f.ExternalId);

        // Build meal food list with denormalized data
        var mealFoods = new List<MealFood>();

        foreach (var item in req.Foods)
        {
            if (!foodLookup.TryGetValue(item.FoodExternalId, out var food))
            {
                AddError($"Food with ID '{item.FoodExternalId}' not found.");
                continue;
            }

            mealFoods.Add(new MealFood
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
            });
        }

        ThrowIfAnyErrors();

        // Update recipe fields
        recipe.Name = req.Name;
        recipe.Description = req.Description;
        recipe.PrepTimeMinutes = req.PrepTimeMinutes;
        recipe.Steps = req.Steps;
        recipe.Note = req.Note;
        recipe.Foods = mealFoods;
        recipe.TotalNutrients = CalculateTotals(mealFoods);
        recipe.Visibility = req.Visibility;
        recipe.DateUpdated = DateTime.UtcNow;

        await mongo.Recipes.ReplaceOneAsync(
            Builders<Recipe>.Filter.Eq(r => r.ExternalId, recipe.ExternalId),
            recipe, cancellationToken: ct);

        await Send.OkAsync(GetRecipeResponse.FromDocument(recipe, currentUserId: nutritionistId), ct);
    }

    /// <summary>
    /// Calculates the total macronutrients from a list of meal foods.
    /// </summary>
    /// <param name="foods">The list of meal foods.</param>
    /// <returns>Computed nutrient totals.</returns>
    private static NutrientTotals CalculateTotals(List<MealFood> foods)
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
}
