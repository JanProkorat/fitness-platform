using FluentAssertions;
using FluentValidation.TestHelper;
using FitnessPlatform.Application.Features.ClientNutrition.LogMealItemEaten;

namespace FitnessPlatform.Tests.Validators;

public class LogMealItemEatenValidatorTests
{
    private readonly LogMealItemEatenValidator _validator = new();

    private static LogMealItemEatenRequest Valid() => new() { MealId = Guid.NewGuid(), ItemId = Guid.NewGuid() };

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
    public void Validate_OccurredAtMoreThanAWeekAgo_Fails()
    {
        var request = Valid();
        request.OccurredAt = DateTimeOffset.UtcNow.AddDays(-8);

        _validator.TestValidate(request).IsValid.Should().BeFalse();
    }
}
