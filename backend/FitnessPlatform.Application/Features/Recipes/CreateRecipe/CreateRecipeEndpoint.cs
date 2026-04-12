using System.Security.Claims;
using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Recipes.Shared;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Features.Recipes.CreateRecipe;

/// <summary>
/// Creates a new recipe with denormalized food data and computed nutrient totals.
/// </summary>
/// <param name="mongo">MongoDB context.</param>
public class CreateRecipeEndpoint(IMongoContext mongo)
    : Endpoint<CreateRecipeRequest, GetRecipeResponse>
{
    /// <inheritdoc />
    public override void Configure()
    {
        Post("/recipes");
        Roles(AppRoles.Nutritionist);
        Summary(s =>
        {
            s.Summary = "Create recipe";
            s.Description = "Creates a new recipe with food items and calculated nutrient totals.";
        });
    }

    /// <inheritdoc />
    public override async Task HandleAsync(CreateRecipeRequest req, CancellationToken ct)
    {
        var userId = User.FindFirstValue(AppClaims.UserId);

        if (userId is null)
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }

        var nutritionistId = Guid.Parse(userId);

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

        // Calculate totals
        var totalNutrients = CalculateTotals(mealFoods);

        var recipe = new Recipe
        {
            ExternalId = Guid.NewGuid(),
            NutritionistId = nutritionistId,
            Name = req.Name,
            Description = req.Description,
            PrepTimeMinutes = req.PrepTimeMinutes,
            Steps = req.Steps,
            Note = req.Note,
            Foods = mealFoods,
            TotalNutrients = totalNutrients,
            Visibility = RecipeVisibility.Private,
            DateCreated = DateTime.UtcNow
        };

        await mongo.Recipes.InsertOneAsync(recipe, cancellationToken: ct);

        await HttpContext.Response.SendAsync(GetRecipeResponse.FromDocument(recipe), 201, cancellation: ct);
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
