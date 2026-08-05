using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.NutritionPlanTemplates.CreateTemplate;
using FitnessPlatform.Application.Features.NutritionPlanTemplates.Shared;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Unit tests for <see cref="CreateTemplateValidator"/>'s week-tree rules (#861 review — BLOCKING):
/// a caller-supplied <c>weeks[]</c> tree must be validated with the same rigor as
/// <c>UpdateTemplateValidator</c>'s identical <see cref="TemplateWeekRequest"/> shape, since
/// <c>instantiate</c> later clones the tree verbatim into a real plan with no revalidation.
/// </summary>
/// <remarks>
/// Asserts on <c>ErrorCode</c>, never on <c>PropertyName</c> — this repo's global camelCasing
/// <c>PropertyNameResolver</c> only takes effect once the full app host has booted, so a bare
/// validator-only test run sees the raw FluentValidation default instead, and a
/// <c>PropertyName</c> assertion that happens to pass in isolation can flake under the full suite.
/// </remarks>
public class CreateTemplateValidatorTests
{
    private readonly CreateTemplateValidator _validator = new();

    /// <summary>
    /// Builds an otherwise-valid week carrying one day with one meal and one food, so the fields
    /// under test can be varied independently.
    /// </summary>
    private static TemplateWeekRequest BuildValidWeek(int weekNumber = 1, int dayOfWeek = 1) => new()
    {
        WeekNumber = weekNumber,
        Days =
        [
            new TemplateDayRequest
            {
                DayOfWeek = dayOfWeek,
                Meals =
                [
                    new TemplateMealRequest
                    {
                        MealId = Guid.NewGuid(),
                        Kind = MealKind.Breakfast,
                        Order = 1,
                        Foods =
                        [
                            new TemplateMealFoodRequest
                            {
                                FoodExternalId = Guid.NewGuid(),
                                FoodName = "Oats",
                                AmountGrams = 80m
                            }
                        ]
                    }
                ]
            }
        ]
    };

    private static CreateTemplateRequest BuildRequest(List<TemplateWeekRequest> weeks) => new()
    {
        Name = "Test Template",
        Weeks = weeks
    };

    [Fact]
    public void Validate_PopulatedValidWeekTree_Passes()
    {
        var result = _validator.TestValidate(BuildRequest([BuildValidWeek()]));

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_DayOfWeekOutOfRange_FailsWithOutOfRangeCode()
    {
        var week = BuildValidWeek();
        week.Days[0].DayOfWeek = 99;

        var result = _validator.TestValidate(BuildRequest([week]));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(error => error.ErrorCode == ErrorCodes.OutOfRange);
    }

    [Fact]
    public void Validate_DuplicateDayOfWeekWithinWeek_FailsWithOutOfRangeCode()
    {
        var week = BuildValidWeek();
        week.Days.Add(new TemplateDayRequest { DayOfWeek = week.Days[0].DayOfWeek, Meals = [] });

        var result = _validator.TestValidate(BuildRequest([week]));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(error => error.ErrorCode == ErrorCodes.OutOfRange);
    }

    [Fact]
    public void Validate_DuplicateWeekNumberAcrossWeeks_FailsWithOutOfRangeCode()
    {
        var result = _validator.TestValidate(BuildRequest([BuildValidWeek(1), BuildValidWeek(1, dayOfWeek: 2)]));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(error => error.ErrorCode == ErrorCodes.OutOfRange);
    }

    [Fact]
    public void Validate_AmountGramsNotPositive_FailsWithOutOfRangeCode()
    {
        var week = BuildValidWeek();
        week.Days[0].Meals[0].Foods[0].AmountGrams = 0m;

        var result = _validator.TestValidate(BuildRequest([week]));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(error => error.ErrorCode == ErrorCodes.OutOfRange);
    }
}
