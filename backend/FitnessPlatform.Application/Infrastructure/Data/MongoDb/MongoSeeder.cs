using MongoDB.Driver;

namespace FitnessPlatform.Application.Infrastructure.Data.MongoDb;

/// <summary>
/// Seeds the MongoDB database with initial data if collections are empty.
/// </summary>
public static class MongoSeeder
{
    /// <summary>
    /// Inserts seed foods into the foods collection if it is empty.
    /// </summary>
    /// <param name="serviceProvider">The application service provider.</param>
    public static async Task SeedAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<MongoContext>>();

        var existingCount = await mongo.Foods.CountDocumentsAsync(FilterDefinition<Domain.Documents.Food>.Empty);
        if (existingCount > 0)
        {
            logger.LogInformation("MongoDB foods collection already has {Count} documents, skipping seed", existingCount);
            return;
        }

        var foods = FoodSeedData.GetFoods();
        await mongo.Foods.InsertManyAsync(foods);
        logger.LogInformation("Seeded {Count} foods into MongoDB", foods.Count);
    }
}
