using FitnessPlatform.Application.Domain.Documents;
using FluentAssertions;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;

namespace FitnessPlatform.Tests.Documents;

/// <summary>
/// Unit tests for the <c>[BsonIgnoreExtraElements]</c> tolerance added to
/// <see cref="NutritionPlan"/> and <see cref="TrainingPlan"/> for #1028: commit
/// e2a62a6c (#1015) removed the root-level <c>DatePublished</c> property from both
/// classes, so a document written before that change still carries the orphaned
/// <c>datePublished</c> element and previously threw <see cref="FormatException"/>
/// on every typed read. No Docker required — pure BSON (de)serialization against
/// in-memory documents.
///
/// <para>
/// The negative test proves the tolerance is root-level only: this backend
/// registers no global <c>IgnoreExtraElements</c> convention, so a stray element on
/// a nested type (not annotated) must still throw. That absence is the load-bearing
/// fact — genuine schema drift anywhere else in the document tree still fails loudly.
/// </para>
/// </summary>
public class PlanLegacyElementSerializationTests
{
    [Fact]
    public void Deserialize_NutritionPlanWithLegacyRootDatePublished_DoesNotThrow()
    {
        var original = new NutritionPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = Guid.NewGuid(),
            NutritionistId = Guid.NewGuid(),
            Name = "Legacy Plan",
            DateCreated = DateTime.UtcNow
        };

        var bsonDoc = original.ToBsonDocument();
        bsonDoc["datePublished"] = BsonNull.Value;

        var deserialized = BsonSerializer.Deserialize<NutritionPlan>(bsonDoc);

        deserialized.ExternalId.Should().Be(original.ExternalId);
        deserialized.ClientId.Should().Be(original.ClientId);
        deserialized.NutritionistId.Should().Be(original.NutritionistId);
        deserialized.Name.Should().Be(original.Name);
    }

    [Fact]
    public void Deserialize_TrainingPlanWithLegacyRootDatePublished_DoesNotThrow()
    {
        var original = new TrainingPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = Guid.NewGuid(),
            TrainerId = Guid.NewGuid(),
            Name = "Legacy Training Plan",
            DateCreated = DateTime.UtcNow
        };

        var bsonDoc = original.ToBsonDocument();
        bsonDoc["datePublished"] = BsonNull.Value;

        var deserialized = BsonSerializer.Deserialize<TrainingPlan>(bsonDoc);

        deserialized.ExternalId.Should().Be(original.ExternalId);
        deserialized.ClientId.Should().Be(original.ClientId);
        deserialized.TrainerId.Should().Be(original.TrainerId);
        deserialized.Name.Should().Be(original.Name);
    }

    [Fact]
    public void Deserialize_NutritionPlanWithStrayElementOnNestedPlanWeek_StillThrows()
    {
        // datePublished is a LIVE, mapped element on PlanWeek (still written by
        // PublishWeekEndpoint) — using it here would pass for the wrong reason.
        // legacyWeekArchived is a synthetic name genuinely unmapped on PlanWeek.
        var original = new NutritionPlan
        {
            ExternalId = Guid.NewGuid(),
            ClientId = Guid.NewGuid(),
            NutritionistId = Guid.NewGuid(),
            Name = "Plan With Nested Drift",
            DateCreated = DateTime.UtcNow,
            Weeks = [new PlanWeek { WeekNumber = 1 }]
        };

        var bsonDoc = original.ToBsonDocument();
        bsonDoc["weeks"].AsBsonArray[0].AsBsonDocument["legacyWeekArchived"] = BsonBoolean.True;

        var act = () => BsonSerializer.Deserialize<NutritionPlan>(bsonDoc);

        act.Should().Throw<FormatException>()
            .WithMessage("*legacyWeekArchived*",
                "[BsonIgnoreExtraElements] on NutritionPlan must not cascade to nested PlanWeek — " +
                "no global convention pack is registered, so genuine schema drift anywhere else " +
                "in the document tree must still fail loudly");
    }
}
