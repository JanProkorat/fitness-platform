using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.NutritionPlans.CopyPlan;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Unit tests for <see cref="CopyNutritionPlanValidator"/>. Asserts on <c>ErrorCode</c>, never
/// on <c>PropertyName</c>, which flakes under the full suite.
/// </summary>
public class CopyNutritionPlanValidatorTests
{
    private readonly CopyNutritionPlanValidator _validator = new();

    private static DateTime NextMonday()
    {
        var today = DateTime.UtcNow.Date;
        var daysUntilMonday = ((int)DayOfWeek.Monday - (int)today.DayOfWeek + 7) % 7;
        return today.AddDays(daysUntilMonday == 0 ? 7 : daysUntilMonday);
    }

    private static CopyNutritionPlanRequest ValidRequest() => new()
    {
        PlanId = Guid.NewGuid(),
        ClientId = Guid.NewGuid()
    };

    [Fact]
    public void Validate_MinimalRequest_Passes()
    {
        var result = _validator.TestValidate(ValidRequest());

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_EmptyClientId_FailsWithRequiredCode()
    {
        var request = ValidRequest();
        request.ClientId = Guid.Empty;

        var result = _validator.TestValidate(request);

        result.Errors.Should().ContainSingle(e => e.ErrorCode == ErrorCodes.Required);
    }

    [Fact]
    public void Validate_EmptyName_FailsWithRequiredCode()
    {
        var request = ValidRequest();
        request.Name = "";

        var result = _validator.TestValidate(request);

        result.Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.Required);
    }

    [Fact]
    public void Validate_NameOver200Chars_FailsWithOutOfRangeCode()
    {
        var request = ValidRequest();
        request.Name = new string('a', 201);

        var result = _validator.TestValidate(request);

        result.Errors.Should().ContainSingle(e => e.ErrorCode == ErrorCodes.OutOfRange);
    }

    [Fact]
    public void Validate_NameOf200Chars_Passes()
    {
        var request = ValidRequest();
        request.Name = new string('a', 200);

        var result = _validator.TestValidate(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_StartDateNotMonday_FailsWithNotMondayCode()
    {
        var request = ValidRequest();
        request.StartDate = NextMonday().AddDays(1);

        var result = _validator.TestValidate(request);

        result.Errors.Should().ContainSingle(e => e.ErrorCode == ErrorCodes.StartDateNotMonday);
    }

    [Fact]
    public void Validate_StartDateInThePast_FailsWithInPastCode()
    {
        var request = ValidRequest();
        request.StartDate = NextMonday().AddDays(-14);

        var result = _validator.TestValidate(request);

        result.Errors.Should().ContainSingle(e => e.ErrorCode == ErrorCodes.StartDateInPast);
    }

    [Fact]
    public void Validate_FutureMonday_Passes()
    {
        var request = ValidRequest();
        request.StartDate = NextMonday();

        var result = _validator.TestValidate(request);

        result.IsValid.Should().BeTrue();
    }
}
