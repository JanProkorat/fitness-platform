using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.SessionTemplates.SaveSessionTemplateFromPlan;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Tests for <see cref="SaveSessionTemplateFromPlanValidator"/>.
/// </summary>
public class SaveSessionTemplateFromPlanValidatorTests
{
    private readonly SaveSessionTemplateFromPlanValidator _validator = new();

    private static SaveSessionTemplateFromPlanRequest ValidRequest() => new()
    {
        PlanId = Guid.NewGuid(),
        WeekNumber = 1,
        DayOfWeek = 1,
        SessionId = Guid.NewGuid(),
        Name = "Saved from plan"
    };

    [Fact]
    public void ValidRequest_PassesValidation()
    {
        var result = _validator.TestValidate(ValidRequest());
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void PlanId_Empty_FailsWithRequiredCode()
    {
        var req = ValidRequest();
        req.PlanId = Guid.Empty;

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.PlanId).WithErrorCode(ErrorCodes.Required);
    }

    [Fact]
    public void WeekNumber_Zero_FailsWithOutOfRangeCode_ShapeNotDomainState()
    {
        // Structurally impossible week number is input shape (400 via the validator),
        // not domain state — it must never be folded into the endpoint's 404 branch.
        var req = ValidRequest();
        req.WeekNumber = 0;

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.WeekNumber).WithErrorCode(ErrorCodes.OutOfRange);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(8)]
    public void DayOfWeek_OutOfRange_FailsWithOutOfRangeCode(int dayOfWeek)
    {
        var req = ValidRequest();
        req.DayOfWeek = dayOfWeek;

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.DayOfWeek).WithErrorCode(ErrorCodes.OutOfRange);
    }

    [Fact]
    public void SessionId_Empty_FailsWithRequiredCode()
    {
        var req = ValidRequest();
        req.SessionId = Guid.Empty;

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.SessionId).WithErrorCode(ErrorCodes.Required);
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
    public void Visibility_OutOfEnum_FailsWithOutOfRangeCode()
    {
        var req = ValidRequest();
        req.Visibility = (LibraryVisibility)99;

        var result = _validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.Visibility).WithErrorCode(ErrorCodes.OutOfRange);
    }
}
