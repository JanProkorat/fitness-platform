using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Features.PaymentSettings.UpdatePaymentSettings;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Rule-by-rule coverage for <see cref="UpdatePaymentSettingsValidator"/>.
/// </summary>
public class UpdatePaymentSettingsValidatorTests
{
    private static UpdatePaymentSettingsRequest Valid() => new()
    {
        PaymentDueDays = 7,
        MessageFormat = PaymentMessageFormat.PackageNameAndMonth,
        VariableSymbolFormat = VariableSymbolFormat.YearMonthClientNumber
    };

    [Theory]
    [InlineData(1)]
    [InlineData(90)]
    public void Validate_DueDaysAtBoundary_Passes(int days)
    {
        var request = Valid();
        request.PaymentDueDays = days;

        new UpdatePaymentSettingsValidator().TestValidate(request).ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(91)]
    public void Validate_DueDaysOutOfRange_FailsWithOutOfRangeCode(int days)
    {
        var request = Valid();
        request.PaymentDueDays = days;

        var result = new UpdatePaymentSettingsValidator().TestValidate(request);

        result.Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.OutOfRange);
    }

    [Fact]
    public void Validate_UndefinedMessageFormat_FailsWithOutOfRangeCode()
    {
        var request = Valid();
        request.MessageFormat = (PaymentMessageFormat)99;

        var result = new UpdatePaymentSettingsValidator().TestValidate(request);

        result.Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.OutOfRange);
    }

    [Fact]
    public void Validate_UndefinedVariableSymbolFormat_FailsWithOutOfRangeCode()
    {
        var request = Valid();
        request.VariableSymbolFormat = (VariableSymbolFormat)0;

        var result = new UpdatePaymentSettingsValidator().TestValidate(request);

        result.Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.OutOfRange);
    }
}
