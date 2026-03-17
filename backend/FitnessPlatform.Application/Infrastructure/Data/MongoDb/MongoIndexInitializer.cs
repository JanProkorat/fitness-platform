using FitnessPlatform.Application.Domain.Documents;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Infrastructure.Data.MongoDb;

/// <summary>
/// Hosted service that creates MongoDB indexes at application startup.
/// </summary>
public class MongoIndexInitializer : IHostedService
{
    private readonly IMongoContext _mongo;
    private readonly ILogger<MongoIndexInitializer> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="MongoIndexInitializer"/>.
    /// </summary>
    public MongoIndexInitializer(IMongoContext mongo, ILogger<MongoIndexInitializer> logger)
    {
        _mongo = mongo;
        _logger = logger;
    }

    /// <summary>
    /// Creates all required MongoDB indexes.
    /// </summary>
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Creating MongoDB indexes...");

        await CreateFoodIndexes(cancellationToken);
        await CreateNutritionPlanIndexes(cancellationToken);
        await CreateMealLogIndexes(cancellationToken);

        _logger.LogInformation("MongoDB indexes created successfully");
    }

    /// <inheritdoc />
    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    private async Task CreateFoodIndexes(CancellationToken ct)
    {
        var indexes = _mongo.Foods.Indexes;

        // Text index on name for fulltext search
        var textIndex = new CreateIndexModel<Food>(
            Builders<Food>.IndexKeys.Text(f => f.Name),
            new CreateIndexOptions { Name = "idx_food_name_text" });

        // Unique sparse index on barcode (only when barcode is present)
        var barcodeIndex = new CreateIndexModel<Food>(
            Builders<Food>.IndexKeys.Ascending(f => f.Barcode),
            new CreateIndexOptions { Name = "idx_food_barcode", Unique = true, Sparse = true });

        // Index on externalId for API lookups
        var externalIdIndex = new CreateIndexModel<Food>(
            Builders<Food>.IndexKeys.Ascending(f => f.ExternalId),
            new CreateIndexOptions { Name = "idx_food_externalId", Unique = true });

        // Index on nutritionistId for custom food queries
        var nutritionistIndex = new CreateIndexModel<Food>(
            Builders<Food>.IndexKeys.Ascending(f => f.NutritionistId),
            new CreateIndexOptions { Name = "idx_food_nutritionistId", Sparse = true });

        await indexes.CreateManyAsync(
            [textIndex, barcodeIndex, externalIdIndex, nutritionistIndex],
            ct);
    }

    private async Task CreateNutritionPlanIndexes(CancellationToken ct)
    {
        var indexes = _mongo.NutritionPlans.Indexes;

        // Compound index on clientId + status for filtered queries
        var clientStatusIndex = new CreateIndexModel<NutritionPlan>(
            Builders<NutritionPlan>.IndexKeys
                .Ascending(p => p.ClientId)
                .Ascending(p => p.Status),
            new CreateIndexOptions { Name = "idx_plan_clientId_status" });

        // Index on externalId for API lookups
        var externalIdIndex = new CreateIndexModel<NutritionPlan>(
            Builders<NutritionPlan>.IndexKeys.Ascending(p => p.ExternalId),
            new CreateIndexOptions { Name = "idx_plan_externalId", Unique = true });

        await indexes.CreateManyAsync([clientStatusIndex, externalIdIndex], ct);
    }

    private async Task CreateMealLogIndexes(CancellationToken ct)
    {
        var indexes = _mongo.MealLogs.Indexes;

        // Compound index on clientId + eatenAt for date-range queries
        var clientDateIndex = new CreateIndexModel<MealLog>(
            Builders<MealLog>.IndexKeys
                .Ascending(l => l.ClientId)
                .Descending(l => l.EatenAt),
            new CreateIndexOptions { Name = "idx_meallog_clientId_eatenAt" });

        await indexes.CreateManyAsync([clientDateIndex], ct);
    }
}
