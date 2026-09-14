using System.Reflection;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FluentAssertions;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;

namespace FitnessPlatform.Tests.Documents;

/// <summary>
/// Unit tests proving the <see cref="NutritionPlanTemplate"/> document's shape (#861), re-proving
/// against the REAL document — not the test-local POCO <c>LibraryVisibilitySerializationTests</c>
/// used for #858 — that a field-absent <c>visibility</c> deserializes to
/// <see cref="LibraryVisibility.Private"/>, and that no client-only field
/// (<c>ClientId</c>, <c>Status</c>, <c>StartDate</c>, publish/complete dates,
/// <c>QuestionnaireResponseId</c>, <c>TargetWeightKg</c>) exists on the type at all. No Docker
/// required — pure BSON (de)serialization against an in-memory document.
/// </summary>
public class NutritionPlanTemplateSerializationTests
{
    /// <summary>
    /// The six client-only fields that must be absent from <see cref="NutritionPlanTemplate"/>
    /// by construction, not merely nulled out — see issue #861's document spec.
    /// </summary>
    private static readonly string[] ClientOnlyFieldNames =
    [
        "ClientId",
        "Status",
        "StartDate",
        "DatePublished",
        "DateCompleted",
        "QuestionnaireResponseId",
        "TargetWeightKg"
    ];

    [Fact]
    public void NutritionPlanTemplate_HasNoClientOnlyFields()
    {
        var propertyNames = typeof(NutritionPlanTemplate)
            .GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Select(p => p.Name)
            .ToList();

        propertyNames.Should().NotContain(ClientOnlyFieldNames,
            "client-only fields must be absent from the template document by construction");
    }

    [Fact]
    public void Visibility_FieldAbsentOnRealDocument_DeserializesToPrivate()
    {
        // Start from Public so a bug that falls back to default(T) via a different path
        // (rather than genuinely reading the missing-initializer field) cannot accidentally pass.
        var original = new NutritionPlanTemplate
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = Guid.NewGuid(),
            Name = "Test Template",
            Visibility = LibraryVisibility.Public,
            DateCreated = DateTime.UtcNow
        };

        var bsonDoc = original.ToBsonDocument();
        bsonDoc.Remove("visibility");

        var deserialized = BsonSerializer.Deserialize<NutritionPlanTemplate>(bsonDoc);

        deserialized.Visibility.Should().Be(LibraryVisibility.Private);
    }

    [Fact]
    public void NutritionPlanTemplate_RoundTripsWeeksAndSupplements()
    {
        var mealId = Guid.NewGuid();
        var supplementId = Guid.NewGuid();

        var original = new NutritionPlanTemplate
        {
            ExternalId = Guid.NewGuid(),
            OwnerId = Guid.NewGuid(),
            Name = "Round Trip Template",
            Goal = PrimaryGoal.LoseFat,
            DietaryStyle = DietaryStyle.Vegan,
            Visibility = LibraryVisibility.Public,
            DateCreated = DateTime.UtcNow,
            Supplements = [new Supplement { ExternalId = supplementId, Name = "Vitamin D3" }],
            Weeks =
            [
                new TemplateWeek
                {
                    WeekNumber = 1,
                    Days =
                    [
                        new PlanDay
                        {
                            DayOfWeek = 1,
                            Meals = [new PlanMeal { MealId = mealId, Kind = MealKind.Breakfast, Order = 1 }]
                        }
                    ]
                }
            ],
            WeekCount = 1
        };

        var bsonDoc = original.ToBsonDocument();
        var deserialized = BsonSerializer.Deserialize<NutritionPlanTemplate>(bsonDoc);

        deserialized.Weeks.Should().HaveCount(1);
        deserialized.Weeks[0].Days.Should().HaveCount(1);
        deserialized.Weeks[0].Days[0].Meals.Should().ContainSingle(m => m.MealId == mealId);
        deserialized.Supplements.Should().ContainSingle(s => s.ExternalId == supplementId);
        deserialized.Goal.Should().Be(PrimaryGoal.LoseFat);
        deserialized.DietaryStyle.Should().Be(DietaryStyle.Vegan);
    }
}
