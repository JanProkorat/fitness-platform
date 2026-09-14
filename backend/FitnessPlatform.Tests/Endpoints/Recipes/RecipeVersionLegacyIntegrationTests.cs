using FluentAssertions;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using MongoDB.Bson;
using MongoDB.Driver;
using Testcontainers.MongoDb;

namespace FitnessPlatform.Tests.Endpoints.Recipes;

/// <summary>
/// Testcontainers integration test that proves the MongoDB.Driver 3.x deserialization
/// behavior for legacy <see cref="Recipe"/> documents missing the <c>version</c> field
/// (every recipe currently stored predates the field — see #1032), and verifies the
/// version-guarded CAS filter used by <c>UpdateRecipeEndpoint</c> makes legacy documents
/// updatable on their first write while still rejecting stale/concurrent writes.
///
/// Mirrors <see cref="FitnessPlatform.Tests.Endpoints.Exercises.LegacyDocumentIntegrationTests"/>
/// — a mock-Mongo unit test cannot prove this: <c>RecipeTestHelpers.CreateMockMongo</c> ignores
/// the <c>FilterDefinition</c> entirely, so a version-filter assertion there would pass whether
/// or not the filter is correct.
/// </summary>
public class RecipeVersionLegacyIntegrationTests : IAsyncLifetime
{
    private static readonly TimeSpan StartupTimeout = TimeSpan.FromSeconds(180);

    private readonly MongoDbContainer _mongo = new MongoDbBuilder("mongo:7").Build();

    private IMongoCollection<Recipe> _recipes = null!;
    private IMongoCollection<BsonDocument> _rawRecipes = null!;

    public async ValueTask InitializeAsync()
    {
        using var cts = new CancellationTokenSource(StartupTimeout);
        await _mongo.StartAsync(cts.Token);

        var client = new MongoClient(_mongo.GetConnectionString());
        var db = client.GetDatabase("fitness_recipe_legacy_doc_test");
        _recipes = db.GetCollection<Recipe>("recipes");
        _rawRecipes = db.GetCollection<BsonDocument>("recipes");
    }

    public async ValueTask DisposeAsync()
    {
        await _mongo.DisposeAsync();
    }

    private static BsonDocument CreateLegacyRawDoc(Guid externalId, Guid nutritionistId)
    {
        return new BsonDocument
        {
            { "externalId", new BsonBinaryData(externalId, GuidRepresentation.Standard) },
            { "nutritionistId", new BsonBinaryData(nutritionistId, GuidRepresentation.Standard) },
            { "name", "Legacy Recipe" },
            { "visibility", RecipeVisibility.Public.ToString() },
            { "dateCreated", DateTime.UtcNow }
            // NOTE: NO version field — simulates the current state of every stored recipe.
        };
    }

    /// <summary>
    /// Documents the real MongoDB.Driver 3.x deserialization behavior:
    ///   - The C# property initializer (= 1) runs during object construction.
    ///   - The BSON driver then overwrites only fields that are present in the BSON document.
    ///   - Since <c>version</c> is absent, the initializer value (1) is preserved.
    ///   → Legacy field-absent doc deserializes to Version = 1 (not 0).
    /// </summary>
    [Fact]
    public async Task LegacyRecipe_NoVersionField_DeserializesTo1()
    {
        var ct = TestContext.Current.CancellationToken;
        var externalId = Guid.NewGuid();

        await _rawRecipes.InsertOneAsync(
            CreateLegacyRawDoc(externalId, Guid.NewGuid()), cancellationToken: ct);

        var recipe = await _recipes
            .Find(Builders<Recipe>.Filter.Eq(r => r.ExternalId, externalId))
            .FirstOrDefaultAsync(ct);

        recipe.Should().NotBeNull();
        recipe!.Version.Should().Be(1,
            "MongoDB.Driver 3.x preserves the C# property initializer value (= 1) " +
            "when the BSON field is absent — legacy recipes deserialize to Version = 1, not 0");
    }

    /// <summary>
    /// Pins the MongoDB driver's semantics for <see cref="BuildLegacyAwareCasFilter"/>'s filter
    /// shape (the standalone helper below, not <c>UpdateRecipeEndpoint</c> itself — see
    /// <c>UpdateRecipeEndpointIntegrationTests</c> for the endpoint-level red/green proof): a CAS
    /// filter that also matches field-absent documents (when <c>req.Version == 1</c>, the value a
    /// client receives for a legacy doc) correctly updates the document on the first write.
    /// </summary>
    [Fact]
    public async Task LegacyRecipe_FixedCasFilter_ReplaceWithVersion1_Succeeds()
    {
        var ct = TestContext.Current.CancellationToken;
        var externalId = Guid.NewGuid();
        var nutritionistId = Guid.NewGuid();

        await _rawRecipes.InsertOneAsync(
            CreateLegacyRawDoc(externalId, nutritionistId), cancellationToken: ct);

        // Client fetches it back — gets Version = 1 (from initializer)
        var recipe = await _recipes
            .Find(Builders<Recipe>.Filter.Eq(r => r.ExternalId, externalId))
            .FirstOrDefaultAsync(ct);

        var clientVersion = recipe!.Version; // = 1
        clientVersion.Should().Be(1, "client receives Version = 1 for a legacy recipe");

        recipe.Name = "Updated Name";
        recipe.Version = clientVersion + 1;

        var fixedFilter = BuildLegacyAwareCasFilter(externalId, clientVersion);

        var result = await _recipes.ReplaceOneAsync(fixedFilter, recipe, cancellationToken: ct);

        result.ModifiedCount.Should().Be(1,
            "the fixed CAS filter handles field-absent legacy recipes " +
            "by also matching when the version field is absent and req.Version == 1");

        var updated = await _recipes
            .Find(Builders<Recipe>.Filter.Eq(r => r.ExternalId, externalId))
            .FirstOrDefaultAsync(ct);

        updated!.Version.Should().Be(2,
            "after the first write the version field is stored and bumped to 2");
    }

    /// <summary>
    /// Pins <see cref="BuildLegacyAwareCasFilter"/>'s filter shape against a real (already-
    /// versioned) document with a stale requested version. Not reachable through
    /// <c>UpdateRecipeEndpoint</c> itself: its in-memory <c>recipe.Version != req.Version</c>
    /// pre-check already returns 409 before the write-time filter is ever consumed, so this test
    /// exists to pin the filter definition's own correctness (it must not weaken CAS for
    /// non-legacy documents), not to simulate a state the endpoint can actually reach.
    /// </summary>
    [Fact]
    public async Task RealVersionedRecipe_StaleVersion_FixedFilter_MatchesZeroDocs()
    {
        var ct = TestContext.Current.CancellationToken;
        var externalId = Guid.NewGuid();

        var recipe = new Recipe
        {
            ExternalId = externalId,
            NutritionistId = Guid.NewGuid(),
            Name = "Real Versioned Recipe",
            Visibility = RecipeVisibility.Public,
            DateCreated = DateTime.UtcNow,
            Version = 3
        };

        await _recipes.InsertOneAsync(recipe, cancellationToken: ct);

        // Stale version = 1, doc is at 3 — even with the fixed filter, this must not match.
        var staleFilter = BuildLegacyAwareCasFilter(externalId, 1);

        recipe.Name = "Stale Update";
        recipe.Version = 2;

        var result = await _recipes.ReplaceOneAsync(staleFilter, recipe, cancellationToken: ct);

        result.ModifiedCount.Should().Be(0,
            "stale version on a real versioned document must not match — " +
            "the version field IS present at 3, Eq(3, 1) is false, " +
            "and Not(Exists(version)) is also false (version IS stored), " +
            "so neither clause matches → correct 409");
    }

    /// <summary>
    /// Pins <see cref="BuildLegacyAwareCasFilter"/>'s filter shape against a field-absent legacy
    /// document with a caller-supplied version other than 1 — the filter must NOT match. Not
    /// reachable through <c>UpdateRecipeEndpoint</c> itself: a legacy doc always deserializes to
    /// <c>Version == 1</c> (per the driver semantics documented above), so the endpoint's
    /// in-memory pre-check already rejects any <c>req.Version != 1</c> against it before the
    /// write-time filter is consumed. This test exists to pin the filter definition's own
    /// correctness, not to simulate a state the endpoint can actually reach.
    /// </summary>
    [Fact]
    public async Task LegacyRecipe_FieldAbsent_NonOneRequestedVersion_DoesNotMatch()
    {
        var ct = TestContext.Current.CancellationToken;
        var externalId = Guid.NewGuid();

        await _rawRecipes.InsertOneAsync(
            CreateLegacyRawDoc(externalId, Guid.NewGuid()), cancellationToken: ct);

        var recipe = await _recipes
            .Find(Builders<Recipe>.Filter.Eq(r => r.ExternalId, externalId))
            .FirstOrDefaultAsync(ct);
        recipe!.Name = "Should Not Apply";
        recipe.Version = 3;

        // A caller claiming version 2 against a field-absent (legacy) document is impossible
        // to have obtained honestly — the client always receives 1 for a legacy doc.
        var filter = BuildLegacyAwareCasFilter(externalId, 2);

        var result = await _recipes.ReplaceOneAsync(filter, recipe, cancellationToken: ct);

        result.ModifiedCount.Should().Be(0,
            "req.Version == 2 has no legacy-absent clause (only req.Version == 1 does), " +
            "and Eq(version, 2) does not match a field-absent document either → correct 409");
    }

    /// <summary>
    /// Builds the legacy-aware CAS filter used by <c>UpdateRecipeEndpoint</c> after the fix.
    /// The filter matches both:
    ///   (a) documents where the <c>version</c> field is present and equals <c>requestedVersion</c>, AND
    ///   (b) documents where the <c>version</c> field is absent (legacy docs) AND
    ///       <c>requestedVersion == 1</c> (the value the client receives for a legacy doc).
    /// </summary>
    private static FilterDefinition<Recipe> BuildLegacyAwareCasFilter(Guid externalId, int requestedVersion)
    {
        var idFilter = Builders<Recipe>.Filter.Eq(r => r.ExternalId, externalId);

        var normalCas = Builders<Recipe>.Filter.Eq(r => r.Version, requestedVersion);

        var legacyAbsent = requestedVersion == 1
            ? Builders<Recipe>.Filter.Not(
                Builders<Recipe>.Filter.Exists(r => r.Version))
            : null;

        var versionClause = legacyAbsent is not null
            ? Builders<Recipe>.Filter.Or(normalCas, legacyAbsent)
            : normalCas;

        return idFilter & versionClause;
    }
}
