using FluentAssertions;
using FitnessPlatform.Application.Features.Foods.Shared;

namespace FitnessPlatform.Tests.Endpoints.Foods;

/// <summary>
/// Unit tests for <see cref="FoodSummary.FromDocument"/>'s <see cref="FoodSummary.IsSystem"/>
/// mapping — the Library badge (System / Mine / Shared) depends on this flag distinguishing a
/// platform catalog entry from a coach-owned one, since <see cref="FoodSummary"/> never exposes
/// the raw owner id.
/// </summary>
public class FoodSummaryMappingTests
{
    [Fact]
    public void FromDocument_SystemFood_IsSystemIsTrue()
    {
        var systemFood = FoodTestHelpers.CreateFood(name: "System Catalog Food", nutritionistId: null);

        var summary = FoodSummary.FromDocument(systemFood);

        summary.IsSystem.Should().BeTrue();
    }

    [Fact]
    public void FromDocument_CoachOwnedFood_IsSystemIsFalse()
    {
        var coachOwnedFood = FoodTestHelpers.CreateFood(name: "Coach's Food", nutritionistId: Guid.NewGuid());

        var summary = FoodSummary.FromDocument(coachOwnedFood);

        summary.IsSystem.Should().BeFalse();
    }
}
