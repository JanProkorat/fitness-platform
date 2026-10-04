using FluentAssertions;
using FluentValidation.TestHelper;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Foods.CreateFood;
using FitnessPlatform.Application.Features.Foods.Shared;

namespace FitnessPlatform.Tests.Endpoints.Foods;

/// <summary>
/// Unit tests for <see cref="CreateFoodValidator"/>.
/// </summary>
public class CreateFoodValidatorTests
{
    private static CreateFoodRequest ValidRequest() => new()
    {
        Name = "Chicken Breast",
        NutrientValue = new NutrientValueDto { Kcal = 125, Protein = 10, Carbs = 10, Fat = 5 },
        CommonServings = [new ServingSizeDto { Label = "100 g", WeightGrams = 100 }],
    };

    [Fact]
    public void Validate_EmptyName_FailsWithCorrectMessage()
    {
        var request = ValidRequest();
        request.Name = "";

        var result = new CreateFoodValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void Validate_NegativeKcal_FailsWithCorrectMessage()
    {
        var request = ValidRequest();
        request.NutrientValue.Kcal = -1;

        var result = new CreateFoodValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.NutrientValue.Kcal);
    }

    [Fact]
    public void Validate_NegativeFiber_FailsWithCorrectMessage()
    {
        var request = ValidRequest();
        request.NutrientValue.Fiber = -1;

        var result = new CreateFoodValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.NutrientValue.Fiber);
    }

    [Fact]
    public void Validate_EmptyCommonServings_FailsWithCorrectMessage()
    {
        var request = ValidRequest();
        request.CommonServings = [];

        var result = new CreateFoodValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.CommonServings);
    }

    [Fact]
    public void Validate_ValidRequest_Passes()
    {
        var result = new CreateFoodValidator().TestValidate(ValidRequest());

        result.ShouldNotHaveValidationErrorFor(x => x.CommonServings);
        result.ShouldNotHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void Validate_AllergensAndDietaryPreferences_Pass()
    {
        var request = ValidRequest();
        request.Allergens = [Allergen.Milk, Allergen.TreeNuts];
        request.DietaryPreferences = [DietaryPreference.Vegan];

        var result = new CreateFoodValidator().TestValidate(request);

        result.ShouldNotHaveValidationErrorFor(x => x.Allergens);
        result.ShouldNotHaveValidationErrorFor(x => x.DietaryPreferences);
    }
}
