using FluentAssertions;
using FluentValidation.TestHelper;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.ClientNutrition.GetWeekMealLog;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Tests for <see cref="GetWeekMealLogValidator"/>.
/// </summary>
public class GetWeekMealLogValidatorTests
{
    private readonly GetWeekMealLogValidator _validator = new();

    [Fact]
    public void Date_RealDate_PassesValidation()
    {
        var result = _validator.TestValidate(new GetWeekMealLogRequest { Date = new DateOnly(2026, 10, 20) });

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Date_Missing_FailsWithRequired()
    {
        var result = _validator.TestValidate(new GetWeekMealLogRequest());

        result.Errors.Should().ContainSingle(e => e.ErrorCode == ErrorCodes.Required);
    }
}
