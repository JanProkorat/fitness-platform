using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Documents;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.MealTemplates.CreateMealTemplate;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Tests for <see cref="CreateMealTemplateValidator"/>.
/// </summary>
public class CreateMealTemplateValidatorTests
{
    private readonly CreateMealTemplateValidator _validator = new();

    private static CreateMealTemplateRequest ValidRequest() => new()
    {
        Name = "Post-Workout Bowl",
        Foods = [new MealFood { FoodExternalId = Guid.NewGuid(), AmountGrams = 150 }]
    };

    [Fact]
    public void ValidRequest_PassesValidation()
    {
        var result = _validator.TestValidate(ValidRequest());
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Name_Empty_FailsWithRequiredCode()
    {
        var req = ValidRequest();
        req.Name = "";

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Name).WithErrorCode(ErrorCodes.Required);
    }

    [Fact]
    public void Name_TooLong_FailsWithOutOfRangeCode()
    {
        var req = ValidRequest();
        req.Name = new string('a', 201);

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Name).WithErrorCode(ErrorCodes.OutOfRange);
    }

    [Fact]
    public void Description_TooLong_FailsWithOutOfRangeCode()
    {
        var req = ValidRequest();
        req.Description = new string('a', 2001);

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Description).WithErrorCode(ErrorCodes.OutOfRange);
    }

    [Fact]
    public void Visibility_OutOfEnum_FailsWithOutOfRangeCode()
    {
        var req = ValidRequest();
        req.Visibility = (LibraryVisibility)99;

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Visibility).WithErrorCode(ErrorCodes.OutOfRange);
    }

    [Fact]
    public void Foods_AmountGramsZero_FailsWithOutOfRangeCode()
    {
        var req = ValidRequest();
        req.Foods = [new MealFood { FoodExternalId = Guid.NewGuid(), AmountGrams = 0 }];

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor("Foods[0].AmountGrams");
    }

    [Fact]
    public void Recipes_ServingsZero_FailsWithOutOfRangeCode()
    {
        var req = ValidRequest();
        req.Recipes = [new MealRecipe { RecipeId = Guid.NewGuid(), Servings = 0 }];

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor("Recipes[0].Servings");
    }
}
