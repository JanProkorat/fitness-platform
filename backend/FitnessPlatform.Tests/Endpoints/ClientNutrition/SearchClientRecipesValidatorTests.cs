using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.ClientNutrition.SearchClientRecipes;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Tests for <see cref="SearchClientRecipesValidator"/>.
/// </summary>
public class SearchClientRecipesValidatorTests
{
    private readonly SearchClientRecipesValidator _validator = new();

    [Fact]
    public void Validate_Defaults_Passes() =>
        _validator.TestValidate(new SearchClientRecipesRequest()).ShouldNotHaveAnyValidationErrors();

    [Fact]
    public void Validate_PageBelowOne_Fails() =>
        _validator.TestValidate(new SearchClientRecipesRequest { Page = 0 })
            .ShouldHaveValidationErrorFor(x => x.Page);

    [Theory]
    [InlineData(0)]
    [InlineData(101)]
    public void Validate_PageSizeOutOfRange_Fails(int pageSize) =>
        _validator.TestValidate(new SearchClientRecipesRequest { PageSize = pageSize })
            .ShouldHaveValidationErrorFor(x => x.PageSize);

    [Fact]
    public void Validate_UndefinedMealType_Fails() =>
        _validator.TestValidate(new SearchClientRecipesRequest { MealType = (MealKind)99 })
            .ShouldHaveValidationErrorFor(x => x.MealType);
}
