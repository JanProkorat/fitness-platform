using FluentAssertions;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Infrastructure.Data.MongoDb;

namespace FitnessPlatform.Tests.Seeding;

/// <summary>
/// Plain unit tests (no Testcontainers) for the seeded food catalog's serving units (#1133):
/// every seeded food's serving label must be a <see cref="ServingUnits"/> key with a positive
/// per-unit gram weight.
/// </summary>
public class FoodSeedServingUnitsTests
{
    /// <summary>Every seeded food must declare at least one common serving size.</summary>
    [Fact]
    public void LoadEntries_EveryFood_HasAtLeastOneServing()
    {
        var entries = FoodSeedData.LoadEntries();

        entries.Should().AllSatisfy(entry =>
            entry.Servings.Should().NotBeNullOrEmpty($"seeded food '{entry.Slug}' must declare at least one common serving"));
    }

    /// <summary>Every seeded serving label must be one of the translated <see cref="ServingUnits"/> keys.</summary>
    [Fact]
    public void LoadEntries_EveryServingLabel_IsAServingUnitsKey()
    {
        var entries = FoodSeedData.LoadEntries();

        entries.Should().AllSatisfy(entry =>
            entry.Servings.Should().AllSatisfy(serving =>
                ServingUnits.All.Should().Contain(serving.Label,
                    $"seeded food '{entry.Slug}' has serving label '{serving.Label}' which is not a ServingUnits key")));
    }

    /// <summary>Every seeded serving's per-unit gram weight must be positive.</summary>
    [Fact]
    public void LoadEntries_EveryServingGrams_IsPositive()
    {
        var entries = FoodSeedData.LoadEntries();

        entries.Should().AllSatisfy(entry =>
            entry.Servings.Should().AllSatisfy(serving =>
                serving.Grams.Should().BeGreaterThan(0,
                    $"seeded food '{entry.Slug}' has a non-positive serving weight")));
    }
}
