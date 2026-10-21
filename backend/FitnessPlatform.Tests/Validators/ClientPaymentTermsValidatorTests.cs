using FastEndpoints;
using FitnessPlatform.Application.Features.ClientPayments.SetClientPaymentTerms;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Input rules of <see cref="SetClientPaymentTermsValidator"/>.
/// </summary>
public class ClientPaymentTermsValidatorTests
{
    private static SetClientPaymentTermsRequest Valid() => new()
    {
        ClientId = Guid.NewGuid(),
        PackageId = Guid.NewGuid()
    };

    private static TestValidationResult<SetClientPaymentTermsRequest> Validate(SetClientPaymentTermsRequest request) =>
        new SetClientPaymentTermsValidator().TestValidate(request);

    [Fact]
    public void Validate_PackageOnly_Passes()
    {
        Validate(Valid()).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_PackageWithDiscount_Passes()
    {
        var request = Valid();
        request.DiscountId = Guid.NewGuid();

        Validate(request).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_DiscountAndCustomPrice_FailsWithTheCombinationCode()
    {
        var request = Valid();
        request.DiscountId = Guid.NewGuid();
        request.CustomPrice = 1000m;

        Validate(request).Errors.Should().Contain(e => e.ErrorCode == "PAYMENT_TERMS_DISCOUNT_AND_CUSTOM_PRICE");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    [InlineData(10_000_000)]
    public void Validate_CustomPriceOutsideTheRange_FailsWithTheAmountCode(int price)
    {
        var request = Valid();
        request.CustomPrice = price;

        Validate(request).Errors.Should().Contain(e => e.ErrorCode == "PAYMENT_AMOUNT_INVALID");
    }

    [Fact]
    public void Validate_CustomPriceAtTheLimit_Passes()
    {
        var request = Valid();
        request.CustomPrice = 9_999_999.99m;

        Validate(request).IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_FirstPeriodMoreThanAYearAway_FailsWithTheStartDateCode()
    {
        var request = Valid();
        request.FirstPeriodStart = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(400);

        Validate(request).Errors.Should().Contain(e => e.ErrorCode == "PAYMENT_START_DATE_INVALID");
    }

    [Fact]
    public void Validate_EmptyPackageId_Fails()
    {
        var request = Valid();
        request.PackageId = Guid.Empty;

        Validate(request).IsValid.Should().BeFalse();
    }
}
