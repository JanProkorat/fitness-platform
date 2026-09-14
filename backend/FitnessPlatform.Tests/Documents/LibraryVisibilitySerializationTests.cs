using FitnessPlatform.Application.Domain.Enums;
using FluentAssertions;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Attributes;

namespace FitnessPlatform.Tests.Documents;

/// <summary>
/// Unit tests for <see cref="LibraryVisibility"/>'s string-storage round-trip and
/// field-absent default, proven against a test-local POCO per issue #858 — no shared
/// document file is touched (the retype of <c>WorkoutTemplate.Visibility</c> and the seeded
/// catalog belong to #860). No Docker required.
/// </summary>
public class LibraryVisibilitySerializationTests
{
    /// <summary>
    /// Stand-in for a new-library document (<c>MealTemplate</c>, <c>NutritionPlanTemplate</c>,
    /// <c>TrainingPlanTemplate</c>): the <see cref="Visibility"/> property carries NO
    /// initializer, so an absent field falls back to <c>default(LibraryVisibility)</c> —
    /// <see cref="LibraryVisibility.Private"/>, because <c>Private = 0</c>.
    /// </summary>
    private sealed class TestLibraryEntry
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public ObjectId Id { get; set; }

        [BsonElement("visibility")]
        [BsonRepresentation(BsonType.String)]
        public LibraryVisibility Visibility { get; set; }
    }

    [Fact]
    public void LibraryVisibility_EnumValues_ArePinned()
    {
        ((int)LibraryVisibility.Private).Should().Be(0);
        ((int)LibraryVisibility.Public).Should().Be(1);
    }

    [Theory]
    [InlineData(LibraryVisibility.Private, "Private")]
    [InlineData(LibraryVisibility.Public, "Public")]
    public void Visibility_RoundTripsAsString(LibraryVisibility visibility, string expectedStringValue)
    {
        var original = new TestLibraryEntry { Visibility = visibility };

        var bsonDoc = original.ToBsonDocument();
        bsonDoc["visibility"].AsString.Should().Be(expectedStringValue);

        var deserialized = BsonSerializer.Deserialize<TestLibraryEntry>(bsonDoc);
        deserialized.Visibility.Should().Be(visibility);
    }

    [Fact]
    public void Visibility_FieldAbsentOnNewLibraryDocument_DeserializesToPrivate()
    {
        // Start from Public so a bug that falls back to default(T) via a different path
        // (rather than genuinely reading the initializer) cannot accidentally pass.
        var original = new TestLibraryEntry { Visibility = LibraryVisibility.Public };

        var bsonDoc = original.ToBsonDocument();
        bsonDoc.Remove("visibility");

        var deserialized = BsonSerializer.Deserialize<TestLibraryEntry>(bsonDoc);

        deserialized.Visibility.Should().Be(LibraryVisibility.Private);
    }
}
