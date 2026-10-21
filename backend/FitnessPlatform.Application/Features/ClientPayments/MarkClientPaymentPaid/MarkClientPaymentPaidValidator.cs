using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientPayments.MarkClientPaymentPaid;

/// <summary>
/// Validates the <see cref="MarkClientPaymentPaidRequest"/>.
/// </summary>
internal sealed class MarkClientPaymentPaidValidator : Validator<MarkClientPaymentPaidRequest>
{
    /// <summary>
    /// Initializes validation rules for marking a payment paid.
    /// </summary>
    public MarkClientPaymentPaidValidator()
    {
        RuleFor(x => x.ClientId).NotEmpty();
        RuleFor(x => x.PaymentId).NotEmpty();

        // One day of slack: the endpoint compares against the calendar day in Prague, which can be a day
        // ahead of UTC.
        RuleFor(x => x.PaidOn)
            .Must(day => day is { } paidOn && paidOn <= DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1))
            .When(x => x.PaidOn is not null)
            .WithErrorCode(ErrorCodes.PaymentPaidOnInFuture)
            .WithMessage("The payment cannot have been paid in the future.");
    }
}
