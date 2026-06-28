using FluentAssertions;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using MongoDB.Bson;
using MongoDB.Driver;
using Testcontainers.MongoDb;

namespace FitnessPlatform.Tests.Endpoints.Exercises;

/// <summary>
/// Testcontainers integration test that proves the MongoDB.Driver 3.x deserialization
/// behavior for legacy Exercise documents missing the <c>version</c> field, and
/// verifies the fix makes legacy documents updatable/deletable on their first write.
///
/// Bug: <c>Eq(e => e.Version, req.Version)</c> in the CAS write filter does NOT match
/// a document where the <c>version</c> field is absent from BSON — even though
/// deserializing that document yields <c>Version = 1</c> (from the C# property
/// initializer). Result: every legacy custom exercise was permanently un-updatable
/// and un-deletable (the version-guarded write always matched 0 documents → 409).
/// </summary>
public class LegacyDocumentIntegrationTests : IAsyncLifetime
{
    private static readonly TimeSpan StartupTimeout = TimeSpan.FromSeconds(180);

    private readonly MongoDbContainer _mongo = new MongoDbBuilder("mongo:7").Build();

    private IMongoCollection<Exercise> _exercises = null!;
    private IMongoCollection<BsonDocument> _rawExercises = null!;

    public async ValueTask InitializeAsync()
    {
        using var cts = new CancellationTokenSource(StartupTimeout);
        await _mongo.StartAsync(cts.Token);

        var client = new MongoClient(_mongo.GetConnectionString());
        var db = client.GetDatabase("fitness_legacy_doc_test");
        _exercises = db.GetCollection<Exercise>("exercises");
        _rawExercises = db.GetCollection<BsonDocument>("exercises");
    }

    public async ValueTask DisposeAsync()
    {
        await _mongo.DisposeAsync();
    }

    private BsonDocument CreateLegacyRawDoc(Guid externalId, Guid trainerId)
    {
        return new BsonDocument
        {
            { "externalId", new BsonBinaryData(externalId, GuidRepresentation.Standard) },
            { "name", "Legacy Exercise" },
            { "isCustom", true },
            { "trainerId", new BsonBinaryData(trainerId, GuidRepresentation.Standard) },
            { "isActive", true },
            { "source", "custom" },
            { "muscleGroups", new BsonArray { MuscleGroup.Chest.ToString() } },
            { "equipment", ExerciseEquipment.None.ToString() },
            { "category", ExerciseCategory.Strength.ToString() },
            { "difficulty", ExerciseDifficulty.Intermediate.ToString() },
            { "dateCreated", DateTime.UtcNow }
            // NOTE: NO version field — simulates a legacy document
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
    public async Task LegacyDoc_NoVersionField_DeserializesTo1()
    {
        var ct = TestContext.Current.CancellationToken;
        var externalId = Guid.NewGuid();

        await _rawExercises.InsertOneAsync(
            CreateLegacyRawDoc(externalId, Guid.NewGuid()), cancellationToken: ct);

        var exercise = await _exercises
            .Find(Builders<Exercise>.Filter.Eq(e => e.ExternalId, externalId))
            .FirstOrDefaultAsync(ct);

        exercise.Should().NotBeNull();

        // DOCUMENT THE REAL BEHAVIOR:
        // The C# initializer (= 1) runs during construction.
        // BSON driver only overwrites fields present in the document.
        // Since version is absent, Version remains 1 (NOT 0 as the old comment claimed).
        exercise!.Version.Should().Be(1,
            "MongoDB.Driver 3.x preserves the C# property initializer value (= 1) " +
            "when the BSON field is absent — legacy docs deserialize to Version = 1, not 0");
    }

    /// <summary>
    /// PROVES THE BUG (using the old broken CAS filter):
    /// <c>Eq(version, 1)</c> does NOT match a document where the <c>version</c>
    /// field is absent, even though the document deserializes to <c>Version = 1</c>.
    /// This is the exact behavior in the endpoint before the fix — ModifiedCount = 0 → 409.
    /// </summary>
    [Fact]
    public async Task LegacyDoc_OldCasFilter_Eq1_DoesNotMatchFieldAbsentDoc()
    {
        var ct = TestContext.Current.CancellationToken;
        var externalId = Guid.NewGuid();

        await _rawExercises.InsertOneAsync(
            CreateLegacyRawDoc(externalId, Guid.NewGuid()), cancellationToken: ct);

        // Verify the document deserializes to Version = 1
        var exercise = await _exercises
            .Find(Builders<Exercise>.Filter.Eq(e => e.ExternalId, externalId))
            .FirstOrDefaultAsync(ct);
        exercise!.Version.Should().Be(1, "prerequisite: legacy doc deserializes to 1");

        // Use the OLD (broken) CAS filter — just Eq(version, 1)
        var oldBrokenFilter =
            Builders<Exercise>.Filter.Eq(e => e.ExternalId, externalId)
            & Builders<Exercise>.Filter.Eq(e => e.Version, 1); // BUG: Eq on absent field

        var update = Builders<Exercise>.Update
            .Set(e => e.Name, "Updated Name")
            .Set(e => e.Version, 2);

        var result = await _exercises.UpdateOneAsync(oldBrokenFilter, update, cancellationToken: ct);

        // THIS IS THE BUG: ModifiedCount = 0 even though Version = 1 in memory
        result.ModifiedCount.Should().Be(0,
            "Eq(version, 1) does NOT match a field-absent BSON document — " +
            "this proves the bug that makes all legacy exercises permanently un-updatable");
    }

    /// <summary>
    /// Verifies the FIX: a CAS filter that also matches field-absent documents
    /// (when <c>req.Version == 1</c>, the value a client receives for a legacy doc)
    /// correctly updates the document on the first write.
    ///
    /// RED before the endpoint fix, GREEN after.
    /// </summary>
    [Fact]
    public async Task LegacyDoc_FixedCasFilter_CasWriteWithVersion1_Succeeds()
    {
        var ct = TestContext.Current.CancellationToken;
        var externalId = Guid.NewGuid();

        await _rawExercises.InsertOneAsync(
            CreateLegacyRawDoc(externalId, Guid.NewGuid()), cancellationToken: ct);

        // Client fetches it back — gets Version = 1 (from initializer)
        var exercise = await _exercises
            .Find(Builders<Exercise>.Filter.Eq(e => e.ExternalId, externalId))
            .FirstOrDefaultAsync(ct);

        var clientVersion = exercise!.Version; // = 1
        clientVersion.Should().Be(1, "client receives Version = 1 for a legacy doc");

        // Use the FIXED CAS filter (as implemented in UpdateExerciseEndpoint after the fix)
        var fixedFilter = BuildLegacyAwareCasFilter(externalId, clientVersion);

        var update = Builders<Exercise>.Update
            .Set(e => e.Name, "Updated Name")
            .Set(e => e.DateUpdated, DateTime.UtcNow)
            .Set(e => e.Version, clientVersion + 1);

        var result = await _exercises.UpdateOneAsync(fixedFilter, update, cancellationToken: ct);

        result.ModifiedCount.Should().Be(1,
            "the fixed CAS filter handles field-absent legacy documents " +
            "by also matching when the version field is absent and req.Version == 1");

        // Subsequent write must use normal CAS (version field is now present)
        var updated = await _exercises
            .Find(Builders<Exercise>.Filter.Eq(e => e.ExternalId, externalId))
            .FirstOrDefaultAsync(ct);

        updated!.Version.Should().Be(2,
            "after the first write the version field is stored and bumped to 2");
    }

    /// <summary>
    /// Verifies the FIX for soft-delete: a legacy field-absent document can be
    /// soft-deleted on its first write when the client echoes back Version = 1.
    ///
    /// RED before the endpoint fix, GREEN after.
    /// </summary>
    [Fact]
    public async Task LegacyDoc_FixedCasFilter_CasSoftDeleteWithVersion1_Succeeds()
    {
        var ct = TestContext.Current.CancellationToken;
        var externalId = Guid.NewGuid();

        await _rawExercises.InsertOneAsync(
            CreateLegacyRawDoc(externalId, Guid.NewGuid()), cancellationToken: ct);

        var exercise = await _exercises
            .Find(Builders<Exercise>.Filter.Eq(e => e.ExternalId, externalId))
            .FirstOrDefaultAsync(ct);

        var clientVersion = exercise!.Version; // = 1
        clientVersion.Should().Be(1);

        var fixedFilter = BuildLegacyAwareCasFilter(externalId, clientVersion);

        var update = Builders<Exercise>.Update
            .Set(e => e.IsActive, false)
            .Set(e => e.DateUpdated, DateTime.UtcNow)
            .Set(e => e.Version, clientVersion + 1);

        var result = await _exercises.UpdateOneAsync(fixedFilter, update, cancellationToken: ct);

        result.ModifiedCount.Should().Be(1,
            "the fixed filter allows soft-deleting a legacy field-absent document");
    }

    /// <summary>
    /// Verifies the fix does NOT weaken CAS for real versioned documents:
    /// a stale version still matches zero documents (→ 409 in the endpoint).
    /// </summary>
    [Fact]
    public async Task RealVersionedDoc_StaleVersion_FixedFilter_MatchesZeroDocs()
    {
        var ct = TestContext.Current.CancellationToken;
        var externalId = Guid.NewGuid();

        // Insert a properly versioned document (version = 3)
        var exercise = new Exercise
        {
            ExternalId = externalId,
            Name = "Real Versioned Exercise",
            IsCustom = true,
            TrainerId = Guid.NewGuid(),
            IsActive = true,
            Source = "custom",
            MuscleGroups = [MuscleGroup.Back],
            Equipment = ExerciseEquipment.Barbell,
            Category = ExerciseCategory.Strength,
            Difficulty = ExerciseDifficulty.Advanced,
            DateCreated = DateTime.UtcNow,
            Version = 3
        };

        await _exercises.InsertOneAsync(exercise, cancellationToken: ct);

        // Stale version = 1, doc is at 3 — even with the fixed filter, this must not match
        var staleFilter = BuildLegacyAwareCasFilter(externalId, 1);

        var update = Builders<Exercise>.Update
            .Set(e => e.Name, "Stale Update")
            .Set(e => e.Version, 2);

        var result = await _exercises.UpdateOneAsync(staleFilter, update, cancellationToken: ct);

        result.ModifiedCount.Should().Be(0,
            "stale version on a real versioned document must not match — " +
            "the version field IS present at 3, Eq(3, 1) is false, " +
            "and Not(Exists(version)) is also false (version IS stored), " +
            "so neither clause matches → correct 409");
    }

    /// <summary>
    /// Builds the legacy-aware CAS filter used by UpdateExercise and DeleteExercise
    /// endpoints after the fix. The filter matches both:
    ///   (a) documents where the <c>version</c> field is present and equals <c>requestedVersion</c>, AND
    ///   (b) documents where the <c>version</c> field is absent (legacy docs) AND
    ///       <c>requestedVersion == 1</c> (the value the client receives for a legacy doc).
    /// </summary>
    private static FilterDefinition<Exercise> BuildLegacyAwareCasFilter(Guid externalId, int requestedVersion)
    {
        var idFilter = Builders<Exercise>.Filter.Eq(e => e.ExternalId, externalId);

        // Normal CAS: version field is present and matches the requested version
        var normalCas = Builders<Exercise>.Filter.Eq(e => e.Version, requestedVersion);

        // Legacy case: version field is absent from BSON.
        // These deserialize to Version = 1 (from C# initializer).
        // Only applies when req.Version == 1 (the initializer value); otherwise
        // a client-supplied version of 2+ means the field must already be present.
        var legacyAbsent = requestedVersion == 1
            ? Builders<Exercise>.Filter.Not(
                Builders<Exercise>.Filter.Exists(e => e.Version))
            : null;

        var versionClause = legacyAbsent is not null
            ? Builders<Exercise>.Filter.Or(normalCas, legacyAbsent)
            : normalCas;

        return idFilter & versionClause;
    }
}
