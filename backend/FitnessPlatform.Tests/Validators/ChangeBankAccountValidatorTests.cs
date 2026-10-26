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

    [Fact]
    public void Validate_BadChecksum_FailsWithInvalidIbanCode()
    {
        var request = Valid();
        request.Iban = "CZ6508000000192000145398";

        var result = new ChangeBankAccountValidator().TestValidate(request);

        result.Errors.Should().Contain(e => e.ErrorCode == ErrorCodes.InvalidIban);
    }

    [Fact]
    public void Validate_BlankAccountHolder_Fails()
    {
        var request = Valid();
        request.AccountHolder = "   ";

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
