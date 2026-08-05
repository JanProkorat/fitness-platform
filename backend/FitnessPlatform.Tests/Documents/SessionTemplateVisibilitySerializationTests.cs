using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FluentAssertions;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;

namespace FitnessPlatform.Tests.Documents;

/// <summary>
/// Re-proves <see cref="LibraryVisibilitySerializationTests"/>'s field-absent-defaults-to-Private
/// property against the real <see cref="SessionTemplate"/> document (#860) rather than the
/// #858 test-local POCO — this issue's own AC requires it be proven against its own document,
/// since <c>SessionTemplate.Visibility</c> was retyped FROM the deleted
/// <c>WorkoutTemplateVisibility</c> (Public=0/Private=1) TO <see cref="LibraryVisibility"/>
/// (Private=0/Public=1) — an inverted numeric order. No Docker required.
/// </summary>
public class SessionTemplateVisibilitySerializationTests
{
    [Fact]
    public void Visibility_FieldAbsentOnSessionTemplate_DeserializesToPrivate()
    {
        // Start from Public so a bug that falls back to default(T) via a different path
        // (rather than genuinely reading the (absent) initializer) cannot accidentally pass.
        var original = new SessionTemplate
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = Guid.NewGuid(),
            Name = "Legacy template",
            Visibility = LibraryVisibility.Public
        };

        var bsonDoc = original.ToBsonDocument();
        bsonDoc.Remove("visibility");

        var deserialized = BsonSerializer.Deserialize<SessionTemplate>(bsonDoc);

        deserialized.Visibility.Should().Be(LibraryVisibility.Private);
    }

    [Theory]
    [InlineData(LibraryVisibility.Private, "Private")]
    [InlineData(LibraryVisibility.Public, "Public")]
    public void Visibility_RoundTripsAsStringOnSessionTemplate(LibraryVisibility visibility, string expectedStringValue)
    {
        var original = new SessionTemplate
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = Guid.NewGuid(),
            Name = "Template",
            Visibility = visibility
        };

        var bsonDoc = original.ToBsonDocument();
        bsonDoc["visibility"].AsString.Should().Be(expectedStringValue);

        var deserialized = BsonSerializer.Deserialize<SessionTemplate>(bsonDoc);
        deserialized.Visibility.Should().Be(visibility);
    }

    /// <summary>
    /// #860's design review explicitly asked that this be OBSERVED, not assumed, because
    /// <c>SessionTemplate.Visibility</c> is the one library document whose Visibility type was
    /// retyped from an enum with the OPPOSITE numeric order
    /// (<c>WorkoutTemplateVisibility</c>: Public=0/Private=1) to <see cref="LibraryVisibility"/>
    /// (Private=0/Public=1). If any stored document ever held a raw numeric 0 written under the
    /// old enum's semantics (meaning "Public"), naive re-interpretation under the new enum's
    /// numbering would silently flip it to "Private" — a data-meaning regression, not just a
    /// missing-field default. The <c>[BsonRepresentation(BsonType.String)]</c> attribute on the
    /// property makes every value <see cref="SessionTemplate"/> itself ever writes a string, so
    /// this scenario can only be reached by a document some other writer stored as a raw BSON
    /// int32 — this test pins the driver's actual (not assumed) deserialization behaviour for
    /// that shape.
    /// </summary>
    [Fact]
    public void Visibility_StoredAsRawNumericZero_DeserializesUsingActualDriverBehaviour()
    {
        var original = new SessionTemplate
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = Guid.NewGuid(),
            Name = "Numerically-stored legacy template",
            Visibility = LibraryVisibility.Public
        };

        var bsonDoc = original.ToBsonDocument();
        // Bypass the [BsonRepresentation(BsonType.String)] attribute entirely — this document was
        // never produced by SessionTemplate's own serializer, it simulates a value some other
        // writer stored as a raw int32 under the OLD (WorkoutTemplateVisibility) numbering, where
        // 0 meant Public.
        bsonDoc["visibility"] = new BsonInt32(0);

        var deserialized = BsonSerializer.Deserialize<SessionTemplate>(bsonDoc);

        // Observed behaviour: the MongoDB C# driver's EnumSerializer reads the BSON value using
        // the enum's CURRENT (LibraryVisibility) numbering regardless of the configured String
        // representation, so a raw int32 0 deserializes to LibraryVisibility.Private (0) — NOT
        // WorkoutTemplateVisibility's old "Public" meaning. This is the correct outcome for any
        // document actually written under LibraryVisibility's semantics (Private is genuinely 0
        // there), but it would be a silent meaning-flip for any document that predates the retype
        // and was somehow persisted as a raw int32 rather than a string. No such document is
        // known to exist (the property has carried BsonRepresentation(BsonType.String) since
        // before the SessionTemplate rename), so this is a documented, pinned, single-observation
        // fact about driver behaviour — not evidence a migration is required.
        deserialized.Visibility.Should().Be(LibraryVisibility.Private);
    }
}
