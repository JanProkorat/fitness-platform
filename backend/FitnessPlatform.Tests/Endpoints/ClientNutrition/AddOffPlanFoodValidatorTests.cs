using FitnessPlatform.Application.Features.ClientNutrition.AddOffPlanFood;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Tests for <see cref="AddOffPlanFoodValidator"/>.
/// </summary>
public class AddOffPlanFoodValidatorTests
{
    private readonly AddOffPlanFoodValidator _validator = new();

    [Fact]
    public void Validate_ValidRequest_Passes() =>
        _validator.TestValidate(new AddOffPlanFoodRequest { FoodExternalId = Guid.NewGuid(), AmountGrams = 120 })
            .ShouldNotHaveAnyValidationErrors();

    [Fact]
    public void Validate_EmptyFoodId_Fails() =>
        _validator.TestValidate(new AddOffPlanFoodRequest { FoodExternalId = Guid.Empty, AmountGrams = 120 })
            .ShouldHaveValidationErrorFor(x => x.FoodExternalId);

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    [InlineData(10001)]
    public void Validate_AmountOutOfRange_Fails(double amount) =>
        _validator.TestValidate(new AddOffPlanFoodRequest { FoodExternalId = Guid.NewGuid(), AmountGrams = (decimal)amount })
            .ShouldHaveValidationErrorFor(x => x.AmountGrams);

    [Fact]
    public void Validate_AmountAtUpperBound_Passes() =>
        _validator.TestValidate(new AddOffPlanFoodRequest
        {
            FoodExternalId = Guid.NewGuid(),
            AmountGrams = AddOffPlanFoodValidator.MaxAmountGrams,
        }).ShouldNotHaveAnyValidationErrors();
}
