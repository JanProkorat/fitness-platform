using FastEndpoints;
using FormUp.Application.Domain.Constants;
using FormUp.Application.Domain.Services;
using FluentValidation;

namespace FormUp.Application.Features.PaymentSettings.ChangeBankAccount;

/// <summary>
/// Validates the <see cref="ChangeBankAccountRequest"/>.
/// </summary>
internal sealed class ChangeBankAccountValidator : Validator<ChangeBankAccountRequest>
{
    /// <summary>
    /// Initializes validation rules for changing the bank account.
    /// </summary>
    public ChangeBankAccountValidator()
    {
        RuleFor(x => x.Iban)
            .Must(IbanValidator.IsValid).WithErrorCode(ErrorCodes.InvalidIban)
            .WithMessage("The IBAN is not valid.");

        RuleFor(x => x.AccountHolder)
            .NotEmpty()
            .MaximumLength(140);
    }
}
