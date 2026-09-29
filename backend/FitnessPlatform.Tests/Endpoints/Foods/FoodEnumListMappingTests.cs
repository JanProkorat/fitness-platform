using FluentAssertions;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Foods.Shared;

namespace FitnessPlatform.Tests.Endpoints.Foods;

/// <summary>
/// Unit tests for <see cref="FoodEnumListMapping"/>.
/// </summary>
public class FoodEnumListMappingTests
{
    [Fact]
    public void ToStoredNames_ReturnsEnumNames()
    {
        var stored = FoodEnumListMapping.ToStoredNames([Allergen.Milk, Allergen.TreeNuts]);

        stored.Should().BeEquivalentTo(["Milk", "TreeNuts"]);
    }

    [Fact]
    public void ParseStoredNames_CaseInsensitiveMatch_Parses()
    {
        var parsed = FoodEnumListMapping.ParseStoredNames<Allergen>(["milk", "GLUTEN"]);

        parsed.Should().BeEquivalentTo([Allergen.Milk, Allergen.Gluten]);
    }

    [Fact]
    public void ParseStoredNames_LegacyTreeNutsAlias_ParsesAsTreeNuts()
    {
        var parsed = FoodEnumListMapping.ParseStoredNames<Allergen>(["tree nuts"]);

        parsed.Should().Equal(Allergen.TreeNuts);
    }

    [Fact]
    public void ParseStoredNames_UnknownValue_IsDropped()
    {
        var parsed = FoodEnumListMapping.ParseStoredNames<Allergen>(["milk", "nuts-of-some-kind"]);

        parsed.Should().Equal(Allergen.Milk);
    }

    [Fact]
    public void ParseStoredNames_EmptyList_ReturnsEmpty()
    {
        var parsed = FoodEnumListMapping.ParseStoredNames<DietaryPreference>([]);

        parsed.Should().BeEmpty();
    }
}
