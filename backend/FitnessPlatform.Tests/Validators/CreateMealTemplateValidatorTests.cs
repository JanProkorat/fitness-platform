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

        // Anchored on the error code, not the property path. The string-literal overload of
        // ShouldHaveValidationErrorFor compares the name verbatim, so it does NOT go through
        // FluentValidation's property-name resolver — and any test in the suite that boots the
        // app installs a camelCase resolver globally, making the actual name
        // "foods[0].amountGrams". A literal "Foods[0].AmountGrams" therefore passes in isolation
        // and fails under the full suite. (The expression overload used elsewhere in this file
        // is unaffected, because it resolves the name the same way the validator does.)
        result.Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.OutOfRange);
    }

    [Fact]
    public void Recipes_ServingsZero_FailsWithOutOfRangeCode()
    {
        var req = ValidRequest();
        req.Recipes = [new MealRecipe { RecipeId = Guid.NewGuid(), Servings = 0 }];

        var result = _validator.TestValidate(req);

        // Error code, not property path — see the note on Foods_AmountGramsZero above.
        result.Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.OutOfRange);
    }
}
