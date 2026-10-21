using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.Discounts.CreateCoachDiscount;
using FitnessPlatform.Application.Features.Discounts.UpdateCoachDiscount;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Rule-by-rule coverage of the coach discount input validation.
/// </summary>
public class CoachDiscountValidatorTests
{
    private readonly CreateCoachDiscountValidator _validator = new();

    private static CreateCoachDiscountRequest Valid() => new()
    {
        Name = "Spring sale",
        Type = DiscountType.Percentage,
        Value = 10m,
        AppliesToAllPackages = true
    };

    [Fact]
    public void Validate_ValidRequest_Passes()
    {
        _validator.TestValidate(Valid()).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_UpdateRequest_UsesTheSameRules()
    {
        var request = new UpdateCoachDiscountRequest { Name = "", Value = 10m, AppliesToAllPackages = true };

        new UpdateCoachDiscountValidator().TestValidate(request).ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(0.5)]
    [InlineData(100.01)]
    public void Validate_PercentageOutOfRange_Fails(double value)
    {
        var request = Valid();
        request.Value = (decimal)value;

        _validator.TestValidate(request).ShouldHaveValidationErrorFor(x => x.Value);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(100)]
    public void Validate_PercentageAtBounds_Passes(double value)
    {
        var request = Valid();
        request.Value = (decimal)value;

        _validator.TestValidate(request).ShouldNotHaveValidationErrorFor(x => x.Value);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(200.123)]
    public void Validate_FixedAmountNonPositiveOrTooPrecise_Fails(double value)
    {
        var request = Valid();
        request.Type = DiscountType.FixedAmount;
        request.Value = (decimal)value;

        _validator.TestValidate(request).ShouldHaveValidationErrorFor(x => x.Value);
    }

    [Fact]
    public void Validate_FixedAmountOverOnePercentCap_Passes()
    {
        var request = Valid();
        request.Type = DiscountType.FixedAmount;
        request.Value = 250m;

        _validator.TestValidate(request).ShouldNotHaveValidationErrorFor(x => x.Value);
    }

    [Fact]
    public void Validate_ValidToBeforeValidFrom_Fails()
    {
        var request = Valid();
        request.ValidFrom = new DateOnly(2026, 11, 10);
        request.ValidTo = new DateOnly(2026, 11, 9);

        _validator.TestValidate(request).ShouldHaveValidationErrorFor(x => x.ValidTo);
    }

    [Fact]
    public void Validate_ValidToEqualsValidFrom_Passes()
    {
        var request = Valid();
        request.ValidFrom = new DateOnly(2026, 11, 10);
        request.ValidTo = new DateOnly(2026, 11, 10);

        _validator.TestValidate(request).ShouldNotHaveValidationErrorFor(x => x.ValidTo);
    }

    [Theory]
    [InlineData(null)]
    [InlineData(0)]
    [InlineData(121)]
    public void Validate_FirstPaymentsWithoutValidCount_Fails(int? count)
    {
        var request = Valid();
        request.Duration = DiscountDuration.FirstPayments;
        request.DurationPayments = count;

        _validator.TestValidate(request).ShouldHaveValidationErrorFor(x => x.DurationPayments);
    }

    [Fact]
    public void Validate_CountSetForEveryPayment_Fails()
    {
        var request = Valid();
        request.DurationPayments = 3;

        _validator.TestValidate(request).ShouldHaveValidationErrorFor(x => x.DurationPayments);
    }

    [Fact]
    public void Validate_NeitherAllPackagesNorList_Fails()
    {
        var request = Valid();
        request.AppliesToAllPackages = false;

        _validator.TestValidate(request).ShouldHaveValidationErrorFor(x => x.PackageIds);
    }

    [Fact]
    public void Validate_ListWithoutAllPackages_Passes()
    {
        var request = Valid();
        request.AppliesToAllPackages = false;
        request.PackageIds = [Guid.NewGuid()];

        _validator.TestValidate(request).ShouldNotHaveValidationErrorFor(x => x.PackageIds);
    }
}
