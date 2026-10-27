using FitnessPlatform.Application.Features.ClientNutrition.SetShoppingListItemTicked;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Endpoints.ClientNutrition;

/// <summary>
/// Tests for <see cref="SetShoppingListItemTickedValidator"/>.
/// </summary>
public class SetShoppingListItemTickedValidatorTests
{
    private readonly SetShoppingListItemTickedValidator _validator = new();

    [Fact]
    public void Validate_ValidRequest_Passes() =>
        _validator.TestValidate(new SetShoppingListItemTickedRequest { WeekNumber = 1, FoodExternalId = Guid.NewGuid(), IsTicked = true })
            .ShouldNotHaveAnyValidationErrors();

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Validate_WeekNumberBelowOne_Fails(int week) =>
        _validator.TestValidate(new SetShoppingListItemTickedRequest { WeekNumber = week, FoodExternalId = Guid.NewGuid() })
            .ShouldHaveValidationErrorFor(x => x.WeekNumber);

    [Fact]
    public void Validate_EmptyFoodId_Fails() =>
        _validator.TestValidate(new SetShoppingListItemTickedRequest { WeekNumber = 1, FoodExternalId = Guid.Empty })
            .ShouldHaveValidationErrorFor(x => x.FoodExternalId);
}
