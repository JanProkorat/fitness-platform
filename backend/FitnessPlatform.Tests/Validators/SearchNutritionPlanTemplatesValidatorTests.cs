using FitnessPlatform.Application.Features.NutritionPlanTemplates.SearchTemplates;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators;

public class SearchNutritionPlanTemplatesValidatorTests
{
    private readonly SearchNutritionPlanTemplatesValidator _validator = new();

    [Theory]
    [InlineData(0)]
    [InlineData(-3)]
    public void Validate_MealsPerDayNotPositive_Fails(int mealsPerDay)
    {
        var result = _validator.TestValidate(new SearchNutritionPlanTemplatesRequest { MealsPerDay = mealsPerDay });

        result.Errors.Should().ContainSingle();
    }

    [Theory]
    [InlineData(null)]
    [InlineData(1)]
    [InlineData(6)]
    public void Validate_MealsPerDayUnsetOrPositive_Passes(int? mealsPerDay)
    {
        var result = _validator.TestValidate(new SearchNutritionPlanTemplatesRequest { MealsPerDay = mealsPerDay });

        result.IsValid.Should().BeTrue();
    }
}
