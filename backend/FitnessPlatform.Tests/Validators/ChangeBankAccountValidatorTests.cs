using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.PaymentSettings.ChangeBankAccount;
using FluentAssertions;
using FluentValidation.TestHelper;

namespace FitnessPlatform.Tests.Validators;

/// <summary>
/// Rule-by-rule coverage for <see cref="ChangeBankAccountValidator"/>.
/// </summary>
public class ChangeBankAccountValidatorTests
{
    private static ChangeBankAccountRequest Valid() => new()
    {
        Iban = "CZ65 0800 0000 1920 0014 5399",
        AccountHolder = "Martin Král"
    };

    [Fact]
    public void Validate_SpacedLowerCaseIban_Passes()
    {
        var request = Valid();
        request.Iban = "cz65 0800 0000 1920 0014 5399";

        new ChangeBankAccountValidator().TestValidate(request).ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("CZ6508000000192000145398")]
    [InlineData("not an iban")]
    [InlineData("")]
    public void Validate_BadChecksumOrShape_FailsWithInvalidIbanCode(string iban)
    {
        var request = Valid();
        request.Iban = iban;

        var result = new ChangeBankAccountValidator().TestValidate(request);

        result.Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.InvalidIban);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Validate_BlankAccountHolder_Fails(string accountHolder)
    {
        var request = Valid();
        request.AccountHolder = accountHolder;

        new ChangeBankAccountValidator().TestValidate(request)
            .ShouldHaveValidationErrorFor(x => x.AccountHolder);
    }

    [Fact]
    public void Validate_AccountHolderOverMaxLength_Fails()
    {
        var request = Valid();
        request.AccountHolder = new string('a', 141);

        new ChangeBankAccountValidator().TestValidate(request)
            .ShouldHaveValidationErrorFor(x => x.AccountHolder);
    }
}
