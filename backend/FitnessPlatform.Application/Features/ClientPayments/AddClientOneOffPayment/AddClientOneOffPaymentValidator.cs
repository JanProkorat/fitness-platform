using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Services;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientPayments.AddClientOneOffPayment;

/// <summary>
/// Validates the <see cref="AddClientOneOffPaymentRequest"/>.
/// </summary>
internal sealed class AddClientOneOffPaymentValidator : Validator<AddClientOneOffPaymentRequest>
{
    /// <summary>
    /// Initializes validation rules for adding a one-off payment.
    /// </summary>
    public AddClientOneOffPaymentValidator()
    {
        RuleFor(x => x.ClientId).NotEmpty();

        RuleFor(x => x.Title)
            .NotEmpty()
            .MaximumLength(100);

        RuleFor(x => x.Amount)
            .Must(amount => amount > 0 && amount <= ClientPaymentSchedule.MaxAmount)
            .WithErrorCode(ErrorCodes.PaymentAmountInvalid)
            .WithMessage("The amount must be above zero and at most 9999999.99.");

        RuleFor(x => x.Currency)
            .IsInEnum().WithErrorCode(ErrorCodes.OutOfRange)
            .When(x => x.Currency.HasValue);

        RuleFor(x => x.DueDate)
            .NotEqual(default(DateOnly));
    }
}
