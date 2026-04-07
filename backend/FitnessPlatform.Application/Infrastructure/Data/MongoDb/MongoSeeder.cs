using FitnessPlatform.Application.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Infrastructure.Data.MongoDb;

/// <summary>
/// Seeds the MongoDB database with initial data if collections are empty.
/// </summary>
public static class MongoSeeder
{
    /// <summary>
    /// Seeds foods, recipes, and exercises into MongoDB if their collections are empty.
    /// </summary>
    /// <param name="serviceProvider">The application service provider.</param>
    public static async Task SeedAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<MongoContext>>();

        // Seed foods
        var existingFoodCount = await mongo.Foods.CountDocumentsAsync(FilterDefinition<Domain.Documents.Food>.Empty);
        if (existingFoodCount > 0)
        {
            logger.LogInformation("MongoDB foods collection already has {Count} documents, skipping seed", existingFoodCount);
        }
        else
        {
            var foods = FoodSeedData.GetFoods();
            await mongo.Foods.InsertManyAsync(foods);
            logger.LogInformation("Seeded {Count} foods into MongoDB", foods.Count);
        }

        // Seed recipes (after foods so we can resolve references)
        var existingRecipeCount = await mongo.Recipes.CountDocumentsAsync(FilterDefinition<Domain.Documents.Recipe>.Empty);
        if (existingRecipeCount > 0)
        {
            logger.LogInformation("MongoDB recipes collection already has {Count} documents, skipping seed", existingRecipeCount);
        }
        else
        {
            var allFoods = await mongo.Foods.Find(FilterDefinition<Domain.Documents.Food>.Empty).ToListAsync();
            var foodLookup = new Dictionary<string, Domain.Documents.Food>(StringComparer.OrdinalIgnoreCase);
            foreach (var food in allFoods)
            {
                if (food.LocalizedNames?.Cs is not null)
                    foodLookup.TryAdd(food.LocalizedNames.Cs, food);
            }

            var userManager = scope.ServiceProvider.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<Domain.Entities.ApplicationUser>>();
            var nutritionists = await userManager.GetUsersInRoleAsync("Nutritionist");

            if (nutritionists.Count == 0)
            {
                logger.LogWarning("No nutritionists found — skipping recipe seed");
            }
            else
            {
                var entries = RecipeSeedData.GetRecipes();
                var allRecipes = new List<Domain.Documents.Recipe>();

                foreach (var nutritionist in nutritionists)
                {
                    var recipes = RecipeSeedData.BuildRecipes(entries, foodLookup, nutritionist.Id);
                    allRecipes.AddRange(recipes);
                }

                if (allRecipes.Count > 0)
                {
                    await mongo.Recipes.InsertManyAsync(allRecipes);
                    logger.LogInformation("Seeded {Count} recipes for {Users} nutritionists into MongoDB",
                        allRecipes.Count, nutritionists.Count);
                }
            }
        }

        // Seed exercises
        var existingExerciseCount = await mongo.Exercises.CountDocumentsAsync(FilterDefinition<Domain.Documents.Exercise>.Empty);
        if (existingExerciseCount > 0)
        {
            logger.LogInformation("MongoDB exercises collection already has {Count} documents, skipping seed", existingExerciseCount);
        }
        else
        {
            var exercises = ExerciseSeedData.GetExercises();
            await mongo.Exercises.InsertManyAsync(exercises);
            logger.LogInformation("Seeded {Count} exercises into MongoDB", exercises.Count);
        }
    }
}
