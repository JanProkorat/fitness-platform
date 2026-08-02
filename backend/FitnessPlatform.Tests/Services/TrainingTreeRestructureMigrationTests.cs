using FitnessPlatform.Application.Infrastructure.Data.MongoDb;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;
using MongoDB.Driver;
using Testcontainers.MongoDb;

namespace FitnessPlatform.Tests.Services;

/// <summary>
/// Testcontainers integration tests (real MongoDB) proving the #857 deletion of the three
/// legacy #837 schema-on-read boot backfills (<c>BackfillTrainingPlanSections</c>,
/// <c>BackfillWorkoutLogSections</c>, <c>BackfillTrainingCompletionVersionAndSections</c>) is
/// permanent: a pre-#837-shaped legacy document booted against
/// <see cref="MongoIndexInitializer.StartAsync"/> today is left byte-for-byte untouched, not
/// silently restructured into the synthesized "Hlavní" wrapper shape those backfills used to
/// produce. This is the absence test that stops the hazard from silently returning — with the
/// backfill gone, a future boot must leave a coach's flat exercise list untouched rather than
/// re-introducing (or worse, half-applying) the old synthesis behaviour.
/// </summary>
/// <remarks>
/// Seeds a raw <see cref="BsonDocument"/> carrying the pre-#837 flat <c>exercises</c> shape
/// (no <c>sections</c>/<c>workouts</c> field at all) directly into the <c>workoutLogs</c>
/// collection — bypassing the typed <c>WorkoutLog</c> class entirely, since it no longer
/// exposes a property to bind that legacy element through. Because the document is never
/// restructured, it can only be re-read as a raw <see cref="BsonDocument"/> afterwards, not
/// through the typed collection (which would throw a <c>BsonSerializationException</c> on the
/// unmapped <c>exercises</c> element). Uses a dedicated, per-test <see cref="MongoDbBuilder"/>
/// container, reusing the shared <see cref="MigrationTestMongoContext"/>, mirroring the sibling
/// boot-migration tests in this folder.
/// </remarks>
public class TrainingTreeRestructureMigrationTests
{
    private static BsonBinaryData GuidBson(Guid value) => new(value, GuidRepresentation.Standard);

    [Fact]
    public async Task StartAsync_LegacyFlatExerciseWorkoutLog_IsLeftUntouched_NoSynthesizedWorkoutWrapper()
    {
        var ct = TestContext.Current.CancellationToken;
        await using var mongoContainer = new MongoDbBuilder("mongo:7").Build();
        await mongoContainer.StartAsync(ct);

        var client = new MongoClient(mongoContainer.GetConnectionString());
        var db = client.GetDatabase("training_tree_restructure_absence_test");
        var mongo = new MigrationTestMongoContext(db);

        var rawLogs = db.GetCollection<BsonDocument>("workoutLogs");

        var logId = Guid.NewGuid();
        var squatId = Guid.NewGuid();

        // NOTE: pre-#837 on-disk shape — flat "exercises" only, no "sections"/"workouts"
        // field at all. This is exactly the hazard the now-deleted BackfillWorkoutLogSections
        // used to guard against by synthesizing a "Hlavní" wrapper section on boot; that
        // backfill (and its TrainingPlan/TrainingCompletion siblings) is gone as of #857 — a
        // document in this shape must now be left exactly as it is, not silently restructured.
        var legacyLogDoc = new BsonDocument
        {
            { "_id", ObjectId.GenerateNewId() },
            { "externalId", GuidBson(logId) },
            { "clientId", GuidBson(Guid.NewGuid()) },
            { "startedAt", DateTime.UtcNow.AddMinutes(-45) },
            { "isCompleted", true },
            { "completedAt", DateTime.UtcNow },
            {
                "exercises", new BsonArray
                {
                    new BsonDocument
                    {
                        { "exerciseExternalId", GuidBson(squatId) },
                        { "exerciseName", "Squat" },
                        {
                            "sets", new BsonArray
                            {
                                new BsonDocument
                                {
                                    { "setNumber", 1 }, { "reps", 10 }, { "weightKg", 80.0 },
                                    { "completedAt", DateTime.UtcNow.AddMinutes(-30) }, { "isPR", false }
                                }
                            }
                        }
                    }
                }
            },
            { "dateCreated", DateTime.UtcNow.AddMinutes(-45) }
        };

        await rawLogs.InsertOneAsync(legacyLogDoc, cancellationToken: ct);

        var beforeBoot = await rawLogs.Find(new BsonDocument("externalId", GuidBson(logId))).FirstOrDefaultAsync(ct);

        var initializer = new MongoIndexInitializer(mongo, NullLogger<MongoIndexInitializer>.Instance);
        var act = async () => await initializer.StartAsync(ct);
        await act.Should().NotThrowAsync(
            "a legacy flat-exercise document must not crash boot now that the synthesizing backfill is gone");

        var afterBoot = await rawLogs.Find(new BsonDocument("externalId", GuidBson(logId))).FirstOrDefaultAsync(ct);

        afterBoot.Should().NotBeNull();

        // BsonDocument.Equals is structural — proves boot mutated 0 fields on this document,
        // not just that a couple of spot-checked fields happen to still look right.
        afterBoot!.Equals(beforeBoot).Should().BeTrue(
            "the document must be left byte-for-byte untouched — no field added, removed, or reordered");

        afterBoot.Contains("workouts").Should().BeFalse(
            "no workouts wrapper must be synthesized now that BackfillWorkoutLogSections is deleted");
        afterBoot.Contains("sections").Should().BeFalse(
            "no legacy sections wrapper must be synthesized either");
        afterBoot["exercises"].AsBsonArray.Should().HaveCount(1,
            "the flat legacy exercise list must be preserved exactly as seeded, not wrapped or dropped");
    }
}
