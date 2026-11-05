using FluentAssertions;
using FluentValidation.TestHelper;
using FormUp.Application.Features.ClientNutrition.UnlogMealItemEaten;

namespace FormUp.Tests.Validators;

public class UnlogMealItemEatenValidatorTests
{
    private readonly UnlogMealItemEatenValidator _validator = new();

    private static UnlogMealItemEatenRequest Valid() => new() { MealId = Guid.NewGuid(), ItemId = Guid.NewGuid() };

    [Fact]
    public void Validate_ValidRequest_Passes() =>
        _validator.TestValidate(Valid()).IsValid.Should().BeTrue();

    [Fact]
    public void Validate_EmptyMealId_Fails()
    {
        var request = Valid();
        request.MealId = Guid.Empty;

        _validator.TestValidate(request).Errors.Should().Contain(e => e.ErrorMessage == "MealId is required.");
    }

    [Fact]
    public void Validate_EmptyItemId_Fails()
    {
        var request = Valid();
        request.ItemId = Guid.Empty;

        _validator.TestValidate(request).Errors.Should().Contain(e => e.ErrorMessage == "ItemId is required.");
    }

    [Fact]
    public void Validate_OccurredAtInTheFuture_Fails()
    {
        var request = Valid();
        request.OccurredAt = DateTimeOffset.UtcNow.AddHours(1);

        _validator.TestValidate(request).IsValid.Should().BeFalse();
    }
}
