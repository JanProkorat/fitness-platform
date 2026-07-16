using System.Linq.Expressions;
using FitnessPlatform.Application.Domain.Documents;
using MongoDB.Driver;

namespace FitnessPlatform.Application.Infrastructure.Data.MongoDb;

/// <summary>
/// Seeds the public catalog (foods, recipes, exercises, workout templates) into MongoDB.
/// Per-document insert-if-missing — safe to re-run against a partially or fully seeded DB;
/// never gates on a whole-collection count (that would skip all new seed data once any document
/// exists). Order matters: foods → recipes (need a food name→ExternalId map) → exercises →
/// workout templates (need an exercise name→ExternalId map). Postgres (roles + system admin user)
/// is seeded separately, always before this, by <see cref="ApplicationDbContextSeed.SeedAsync"/>.
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

        // 1. Foods.
        await SeedCollectionAsync(
            mongo.Foods, FoodSeedData.GetFoods(),
            f => f.ExternalId, f => f.Name, logger, "foods");

        // 2. Recipes — resolve ingredient food references against the food collection's ACTUAL
        //    persisted state, not the in-memory deterministic ExternalId. On a DB that already
        //    has a same-named legacy food (predating this seeder, random ExternalId), the
        //    name-dedupe in step 1 skips re-inserting it — so recipe ingredient references must
        //    bind to that document's real ExternalId or they'd dangle. See #810 review B1.
        var foodNameToExternalId = await BuildNameToExternalIdMapAsync(
            mongo.Foods, f => new NameExternalIdProjection { Name = f.Name, ExternalId = f.ExternalId });
        await SeedCollectionAsync(
            mongo.Recipes, RecipeSeedData.GetRecipes(foodNameToExternalId),
            r => r.ExternalId, r => r.Name, logger, "recipes");

        // 3. Exercises.
        await SeedCollectionAsync(
            mongo.Exercises, ExerciseSeedData.GetExercises(),
            e => e.ExternalId, e => e.Name, logger, "exercises");

        // 4. Workout templates — same DB-resolution pattern as recipes, for exercise references.
        var exerciseNameToExternalId = await BuildNameToExternalIdMapAsync(
            mongo.Exercises, e => new NameExternalIdProjection { Name = e.Name, ExternalId = e.ExternalId });
        await SeedCollectionAsync(
            mongo.WorkoutTemplates, WorkoutTemplateSeedData.GetWorkoutTemplates(exerciseNameToExternalId),
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

    /// <summary>
    /// Builds a case-insensitive Name → ExternalId map from the collection's current DB state
    /// (not the in-memory seed candidates). This is what lets a downstream seeder (recipes,
    /// workout templates) resolve a cross-reference to whichever ExternalId is ACTUALLY
    /// persisted for that name — the deterministic seed ID on a fresh DB, or a pre-existing
    /// legacy document's random ID when one already occupies that name. First-wins on duplicate
    /// names (matches the dedupe's assumption that names are effectively unique within a
    /// collection); a name collision beyond that is a pre-existing data-quality issue, not
    /// something this seeder should silently duplicate-resolve.
    /// </summary>
    private static async Task<Dictionary<string, Guid>> BuildNameToExternalIdMapAsync<TDocument>(
        IMongoCollection<TDocument> collection,
        Expression<Func<TDocument, NameExternalIdProjection>> projector)
    {
        var rows = await collection
            .Find(FilterDefinition<TDocument>.Empty)
            .Project(projector)
            .ToListAsync();

        var map = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in rows)
        {
            map.TryAdd(row.Name, row.ExternalId);
        }

        return map;
    }

    /// <summary>Projection shape for <see cref="BuildNameToExternalIdMapAsync{TDocument}"/>.</summary>
    private sealed class NameExternalIdProjection
    {
        public string Name { get; set; } = string.Empty;
        public Guid ExternalId { get; set; }
    }
}
