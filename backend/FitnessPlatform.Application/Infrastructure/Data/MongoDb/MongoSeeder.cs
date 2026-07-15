using System.Linq.Expressions;
using FitnessPlatform.Application.Domain.Documents;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Infrastructure.Data.MongoDb;

/// <summary>
/// Seeds the public catalog (foods, recipes, exercises, workout templates) into MongoDB.
/// Per-document insert-if-missing — safe to re-run against a partially or fully seeded DB;
/// never gates on a whole-collection count (that would skip all new seed data once any document
/// exists). Order matters: foods → recipes (need food lookup) → exercises → workout templates
/// (need exercise lookup). Postgres (roles + system admin user) is seeded separately, always
/// before this, by <see cref="ApplicationDbContextSeed.SeedAsync"/>.
/// </summary>
public static class MongoSeeder
{
    /// <summary>
    /// Seeds foods, recipes, exercises, and workout templates into MongoDB.
    /// </summary>
    /// <param name="serviceProvider">The application service provider.</param>
    public static async Task SeedAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<IMongoContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<MongoContext>>();

        await SeedCollectionAsync(
            mongo.Foods, FoodSeedData.GetFoods(),
            f => f.ExternalId, f => f.Name, logger, "foods");

        await SeedCollectionAsync(
            mongo.Recipes, RecipeSeedData.GetRecipes(),
            r => r.ExternalId, r => r.Name, logger, "recipes");

        await SeedCollectionAsync(
            mongo.Exercises, ExerciseSeedData.GetExercises(),
            e => e.ExternalId, e => e.Name, logger, "exercises");

        await SeedCollectionAsync(
            mongo.WorkoutTemplates, WorkoutTemplateSeedData.GetWorkoutTemplates(),
            t => t.ExternalId, t => t.Name, logger, "workout templates");
    }

    /// <summary>
    /// Inserts every candidate document whose <c>ExternalId</c> AND normalized <c>Name</c> are
    /// both absent from the collection. The name check protects legacy dev DBs whose existing
    /// seed docs carry random (pre-deterministic-GUID) ExternalIds from getting duplicated.
    /// </summary>
    private static async Task SeedCollectionAsync<TDocument>(
        IMongoCollection<TDocument> collection,
        List<TDocument> candidates,
        Expression<Func<TDocument, Guid>> externalIdSelector,
        Expression<Func<TDocument, string>> nameSelector,
        ILogger logger,
        string collectionLabel)
    {
        if (candidates.Count == 0)
        {
            return;
        }

        var compiledExternalIdSelector = externalIdSelector.Compile();
        var compiledNameSelector = nameSelector.Compile();

        var existingExternalIds = await collection
            .Find(FilterDefinition<TDocument>.Empty)
            .Project(externalIdSelector)
            .ToListAsync();
        var existingExternalIdSet = new HashSet<Guid>(existingExternalIds);

        var existingNames = await collection
            .Find(FilterDefinition<TDocument>.Empty)
            .Project(nameSelector)
            .ToListAsync();
        var existingNameSet = new HashSet<string>(existingNames, StringComparer.OrdinalIgnoreCase);

        var toInsert = candidates
            .Where(c => !existingExternalIdSet.Contains(compiledExternalIdSelector(c))
                        && !existingNameSet.Contains(compiledNameSelector(c)))
            .ToList();

        if (toInsert.Count == 0)
        {
            logger.LogInformation(
                "MongoDB {Collection}: nothing new to seed ({ExistingCount} already present)",
                collectionLabel, existingExternalIdSet.Count);
            return;
        }

        await collection.InsertManyAsync(toInsert);
        logger.LogInformation(
            "Seeded {InsertedCount} new {Collection} into MongoDB ({SkippedCount} already present)",
            toInsert.Count, collectionLabel, candidates.Count - toInsert.Count);
    }
}
