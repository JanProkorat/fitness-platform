using FitnessPlatform.Application.Features.Trainers.UpdateClientNutritionProfile;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Endpoints.Trainers;

/// <summary>
/// Unit tests for <see cref="UpdateClientNutritionProfileValidator"/>.
/// </summary>
public class UpdateClientNutritionProfileValidatorTests
{
    private static UpdateClientNutritionProfileRequest Valid() => new()
    {
        ClientId = Guid.NewGuid(),
        Dislikes = ["Mushrooms"],
        Habits = ["Cooks on Sundays"],
        Allergies = ["lactose"],
        FibreGrams = 30m
    };

    private static bool Passes(UpdateClientNutritionProfileRequest request) =>
        new UpdateClientNutritionProfileValidator().TestValidate(request).IsValid;

    [Fact]
    public void Validate_ValidRequest_Passes() => Passes(Valid()).Should().BeTrue();

    [Fact]
    public void Validate_EmptyLists_AndNoFibre_Passes()
    {
        var request = Valid();
        request.Dislikes = [];
        request.Habits = [];
        request.Allergies = [];
        request.FibreGrams = null;

        Passes(request).Should().BeTrue();
    }

    [Theory]
    [InlineData(20, true)]
    [InlineData(21, false)]
    public void Validate_DislikeCount_Boundary(int count, bool expectedValid)
    {
        var request = Valid();
        request.Dislikes = Enumerable.Range(0, count).Select(i => $"item{i}").ToList();

        Passes(request).Should().Be(expectedValid);
    }

    [Theory]
    [InlineData(20, true)]
    [InlineData(21, false)]
    public void Validate_HabitCount_Boundary(int count, bool expectedValid)
    {
        var request = Valid();
        request.Habits = Enumerable.Range(0, count).Select(i => $"item{i}").ToList();

        Passes(request).Should().Be(expectedValid);
    }

    [Theory]
    [InlineData(60, true)]
    [InlineData(61, false)]
    public void Validate_DislikeLength_Boundary(int length, bool expectedValid)
    {
        var request = Valid();
        request.Dislikes = [new string('a', length)];

        Passes(request).Should().Be(expectedValid);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Validate_BlankDislike_Fails(string item)
    {
        var request = Valid();
        request.Dislikes = [item];

        Passes(request).Should().BeFalse();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Validate_BlankHabit_Fails(string item)
    {
        var request = Valid();
        request.Habits = [item];

        Passes(request).Should().BeFalse();
    }

    [Fact]
    public void Validate_HabitOverSixtyChars_Fails()
    {
        var request = Valid();
        request.Habits = [new string('a', 61)];

        Passes(request).Should().BeFalse();
    }

    [Fact]
    public void Validate_AllergyContainingComma_Fails()
    {
        var request = Valid();
        request.Allergies = ["nuts,gluten"];

        var result = new UpdateClientNutritionProfileValidator().TestValidate(request);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.ErrorMessage.Contains("comma"));
    }

    [Fact]
    public void Validate_BlankAllergy_Fails()
    {
        var request = Valid();
        request.Allergies = [" "];

        Passes(request).Should().BeFalse();
    }

    [Theory]
    [InlineData(200, true)]
    [InlineData(201, false)]
    public void Validate_AllergiesJoinedLength_Boundary(int joinedLength, bool expectedValid)
    {
        // Two items joined by one comma: lengths sum to joinedLength - 1 plus the comma.
        var request = Valid();
        request.Allergies = [new string('a', 100), new string('b', joinedLength - 101)];

        Passes(request).Should().Be(expectedValid);
    }

    [Theory]
    [InlineData(0, true)]
    [InlineData(150, true)]
    [InlineData(-0.1, false)]
    [InlineData(150.1, false)]
    public void Validate_FibreGrams_Boundary(double fibre, bool expectedValid)
    {
        var request = Valid();
        request.FibreGrams = (decimal)fibre;

        Passes(request).Should().Be(expectedValid);
    }

    [Fact]
    public void Validate_EmptyClientId_Fails()
    {
        var request = Valid();
        request.ClientId = Guid.Empty;

        Passes(request).Should().BeFalse();
    }
}
