using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FluentAssertions;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;

namespace FitnessPlatform.Tests.Documents;

/// <summary>
/// Re-proves <see cref="LibraryVisibilitySerializationTests"/>'s field-absent-defaults-to-Private
/// property against the real <see cref="MealTemplate"/> document (#859) rather than the
/// #858 test-local POCO — this issue's own AC requires it be proven against its own document.
/// No Docker required.
/// </summary>
public class MealTemplateVisibilitySerializationTests
{
    [Fact]
    public void Visibility_FieldAbsentOnMealTemplate_DeserializesToPrivate()
    {
        // Start from Public so a bug that falls back to default(T) via a different path
        // (rather than genuinely reading the (absent) initializer) cannot accidentally pass.
        var original = new MealTemplate
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = Guid.NewGuid(),
            Name = "Legacy meal",
            Visibility = LibraryVisibility.Public
        };

        var bsonDoc = original.ToBsonDocument();
        bsonDoc.Remove("visibility");

        var deserialized = BsonSerializer.Deserialize<MealTemplate>(bsonDoc);

        deserialized.Visibility.Should().Be(LibraryVisibility.Private);
    }

    [Theory]
    [InlineData(LibraryVisibility.Private, "Private")]
    [InlineData(LibraryVisibility.Public, "Public")]
    public void Visibility_RoundTripsAsStringOnMealTemplate(LibraryVisibility visibility, string expectedStringValue)
    {
        var original = new MealTemplate
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = Guid.NewGuid(),
            Name = "Meal",
            Visibility = visibility
        };

        var bsonDoc = original.ToBsonDocument();
        bsonDoc["visibility"].AsString.Should().Be(expectedStringValue);

        var deserialized = BsonSerializer.Deserialize<MealTemplate>(bsonDoc);
        deserialized.Visibility.Should().Be(visibility);
    }
}
