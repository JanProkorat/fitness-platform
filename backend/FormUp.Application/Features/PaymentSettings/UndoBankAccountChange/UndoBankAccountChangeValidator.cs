using FastEndpoints;
using FormUp.Application.Domain.Constants;
using FluentValidation;

namespace FormUp.Application.Features.PaymentSettings.UndoBankAccountChange;

/// <summary>
/// Validates the <see cref="UndoBankAccountChangeRequest"/>.
/// </summary>
internal sealed class UndoBankAccountChangeValidator : Validator<UndoBankAccountChangeRequest>
{
    /// <summary>
    /// Initializes validation rules for undoing a bank account change.
    /// </summary>
    public UndoBankAccountChangeValidator()
    {
        RuleFor(x => x.Token)
            .NotEmpty().WithErrorCode(ErrorCodes.BankAccountUndoInvalid)
            .MaximumLength(128).WithErrorCode(ErrorCodes.BankAccountUndoInvalid);
    }
}
