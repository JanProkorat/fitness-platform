using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.CoachPackages.CreateCoachPackage;
using FitnessPlatform.Application.Features.CoachPackages.UpdateCoachPackage;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Rule-by-rule coverage of the coach package input validation.
/// </summary>
public class CoachPackageValidatorTests
{
    private readonly CreateCoachPackageValidator _validator = new();

    private static CreateCoachPackageRequest Valid() => new()
    {
        Name = "Online coaching",
        Price = 1500m,
        Billing = PackageBillingInterval.Monthly
    };

    [Fact]
    public void Validate_ValidRequest_Passes()
    {
        _validator.TestValidate(Valid()).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_UpdateRequest_UsesTheSameRules()
    {
        var request = new UpdateCoachPackageRequest { Name = "", Price = 10m };

        new UpdateCoachPackageValidator().TestValidate(request).ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void Validate_BlankName_Fails()
    {
        var request = Valid();
        request.Name = "   ";

        _validator.TestValidate(request).ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void Validate_NameOver100Chars_Fails()
    {
        var request = Valid();
        request.Name = new string('a', 101);

        _validator.TestValidate(request).ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1_000_000.01)]
    [InlineData(10.123)]
    public void Validate_PriceOutOfRangeOrTooPrecise_Fails(double price)
    {
        var request = Valid();
        request.Price = (decimal)price;

        _validator.TestValidate(request).ShouldHaveValidationErrorFor(x => x.Price);
    }

    [Theory]
    [InlineData(0.01)]
    [InlineData(1_000_000)]
    public void Validate_PriceAtBounds_Passes(double price)
    {
        var request = Valid();
        request.Price = (decimal)price;

        _validator.TestValidate(request).ShouldNotHaveValidationErrorFor(x => x.Price);
    }

    [Theory]
    [InlineData(50_000, true)]
    [InlineData(50_000.01, false)]
    public void Validate_EuroPriceAtItsCap(double price, bool passes)
    {
        var request = Valid();
        request.Currency = PaymentCurrency.EUR;
        request.Price = (decimal)price;

        var result = _validator.TestValidate(request);

        if (passes)
        {
            result.ShouldNotHaveValidationErrorFor(x => x.Price);
        }
        else
        {
            result.ShouldHaveValidationErrorFor(x => x.Price);
        }
    }

    [Fact]
    public void Validate_DescriptionOver500Chars_Fails()
    {
        var request = Valid();
        request.Description = new string('a', 501);

        _validator.TestValidate(request).ShouldHaveValidationErrorFor(x => x.Description);
    }

    [Fact]
    public void Validate_BillingNotInEnum_Fails()
    {
        var request = Valid();
        request.Billing = (PackageBillingInterval)99;

        _validator.TestValidate(request).ShouldHaveValidationErrorFor(x => x.Billing);
    }

    [Theory]
    [InlineData(null)]
    [InlineData(0)]
    [InlineData(53)]
    public void Validate_EveryNWeeksWithoutValidWeeks_Fails(int? weeks)
    {
        var request = Valid();
        request.Billing = PackageBillingInterval.EveryNWeeks;
        request.IntervalWeeks = weeks;

        _validator.TestValidate(request).ShouldHaveValidationErrorFor(x => x.IntervalWeeks);
    }

    [Fact]
    public void Validate_EveryNWeeksWithValidWeeks_Passes()
    {
        var request = Valid();
        request.Billing = PackageBillingInterval.EveryNWeeks;
        request.IntervalWeeks = 52;

        _validator.TestValidate(request).ShouldNotHaveValidationErrorFor(x => x.IntervalWeeks);
    }

    [Fact]
    public void Validate_WeeksSetForMonthlyBilling_Fails()
    {
        var request = Valid();
        request.IntervalWeeks = 4;

        _validator.TestValidate(request).ShouldHaveValidationErrorFor(x => x.IntervalWeeks);
    }

    [Fact]
    public void Validate_RunsForPaymentsOnOneOff_Fails()
    {
        var request = Valid();
        request.Billing = PackageBillingInterval.OneOff;
        request.RunsForPayments = 3;

        _validator.TestValidate(request).ShouldHaveValidationErrorFor(x => x.RunsForPayments);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(121)]
    public void Validate_RunsForPaymentsOutOfRange_Fails(int runs)
    {
        var request = Valid();
        request.RunsForPayments = runs;

        _validator.TestValidate(request).ShouldHaveValidationErrorFor(x => x.RunsForPayments);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(91)]
    public void Validate_DueDaysOverrideOutOfRange_Fails(int days)
    {
        var request = Valid();
        request.PaymentDueDaysOverride = days;

        _validator.TestValidate(request).ShouldHaveValidationErrorFor(x => x.PaymentDueDaysOverride);
    }

    [Fact]
    public void Validate_ErrorCodes_AreScreamingSnakeCase()
    {
        var request = Valid();
        request.Price = 0m;

        var result = _validator.TestValidate(request);

        result.Errors.Select(e => e.ErrorCode).Should().OnlyContain(code => code == "OUT_OF_RANGE");
    }
}
