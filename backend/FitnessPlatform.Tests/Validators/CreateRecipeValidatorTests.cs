using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Recipes.CreateRecipe;
using FitnessPlatform.Application.Features.Recipes.Shared;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Tests for <see cref="CreateRecipeValidator"/>.
/// </summary>
public class CreateRecipeValidatorTests
{
    private readonly CreateRecipeValidator _validator = new();

    private static CreateRecipeRequest ValidRequest() => new()
    {
        Name = "Chicken Salad",
        MealTypes = [RecipeMealType.Lunch],
        Foods = [new RecipeFoodDto { FoodExternalId = Guid.NewGuid(), AmountGrams = 100 }]
    };

    [Fact]
    public void BaselineRequest_IsValid_AndDefaultsToPrivateWithOneServing()
    {
        var req = ValidRequest();

        _validator.TestValidate(req).IsValid.Should().BeTrue();
        req.Visibility.Should().Be(RecipeVisibility.Private);
        req.Servings.Should().Be(1);
    }

    [Fact]
    public void Servings_Zero_FailsValidation()
    {
        var req = ValidRequest();
        req.Servings = 0;

        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Servings);
    }

    [Fact]
    public void MealTypes_Empty_FailsValidation()
    {
        var req = ValidRequest();
        req.MealTypes = [];

        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.MealTypes);
    }

    [Fact]
    public void Foods_Empty_FailsValidation()
    {
        var req = ValidRequest();
        req.Foods = [];

        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.Foods);
    }

    [Fact]
    public void Steps_OverCountOrLength_FailsValidation()
    {
        var tooMany = ValidRequest();
        tooMany.Steps = Enumerable.Repeat("step", 51).ToList();
        var tooLong = ValidRequest();
        tooLong.Steps = [new string('x', 2001)];

        _validator.TestValidate(tooMany).IsValid.Should().BeFalse();
        _validator.TestValidate(tooLong).IsValid.Should().BeFalse();
    }

    [Fact]
    public void NegativeCookTime_FailsValidation()
    {
        var req = ValidRequest();
        req.CookTimeMinutes = -1;

        _validator.TestValidate(req).ShouldHaveValidationErrorFor(x => x.CookTimeMinutes);
    }
}
