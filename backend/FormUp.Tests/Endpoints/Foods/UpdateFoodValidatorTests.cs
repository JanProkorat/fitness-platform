using FluentAssertions;
using FluentValidation.TestHelper;
using FormUp.Application.Domain.Constants;
using FormUp.Application.Domain.Enums;
using FormUp.Application.Features.Foods.Shared;
using FormUp.Application.Features.Foods.UpdateFood;

namespace FormUp.Tests.Endpoints.Foods;

/// <summary>
/// Unit tests for <see cref="UpdateFoodValidator"/>.
/// </summary>
public class UpdateFoodValidatorTests
{
    private static UpdateFoodRequest ValidRequest() => new()
    {
        FoodId = Guid.NewGuid(),
        Name = "Chicken Breast",
        NutrientValue = new NutrientValueDto { Kcal = 125, Protein = 10, Carbs = 10, Fat = 5 },
        CommonServings = [new ServingSizeDto { Label = "100 g", WeightGrams = 100 }],
    };

    [Fact]
    public void Validate_EmptyFoodId_FailsWithCorrectMessage()
    {
        var request = ValidRequest();
        request.FoodId = Guid.Empty;

        var result = new UpdateFoodValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.FoodId);
    }

    [Fact]
    public void Validate_EmptyCommonServings_FailsWithCorrectMessage()
    {
        var request = ValidRequest();
        request.CommonServings = [];

        var result = new UpdateFoodValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.CommonServings);
    }

    [Fact]
    public void Validate_NegativeFiber_FailsWithCorrectMessage()
    {
        var request = ValidRequest();
        request.NutrientValue.Fiber = -1;

        var result = new UpdateFoodValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.NutrientValue.Fiber);
    }

    [Fact]
    public void Validate_InconsistentKcal_FailsWithKcalInconsistentErrorCode()
    {
        var request = ValidRequest();
        request.NutrientValue = new NutrientValueDto { Kcal = 999, Protein = 10, Carbs = 10, Fat = 5 };

        var result = new UpdateFoodValidator().TestValidate(request);

        result.ShouldHaveValidationErrorFor(x => x.NutrientValue)
            .WithErrorCode(ErrorCodes.KcalInconsistent);
    }

    [Fact]
    public void Validate_ValidRequest_Passes()
    {
        var result = new UpdateFoodValidator().TestValidate(ValidRequest());

        result.ShouldNotHaveValidationErrorFor(x => x.CommonServings);
        result.ShouldNotHaveValidationErrorFor(x => x.FoodId);
    }

    [Fact]
    public void Validate_AllergensAndDietaryPreferences_Pass()
    {
        var request = ValidRequest();
        request.Allergens = [Allergen.Gluten];
        request.DietaryPreferences = [DietaryPreference.Keto];

        var result = new UpdateFoodValidator().TestValidate(request);

        result.ShouldNotHaveValidationErrorFor(x => x.Allergens);
        result.ShouldNotHaveValidationErrorFor(x => x.DietaryPreferences);
    }
}
