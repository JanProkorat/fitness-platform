using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientPayments.WaiveClientPayment;

/// <summary>
/// Validates the <see cref="WaiveClientPaymentRequest"/>.
/// </summary>
internal sealed class WaiveClientPaymentValidator : Validator<WaiveClientPaymentRequest>
{
    /// <summary>
    /// Initializes validation rules for waiving a payment.
    /// </summary>
    public WaiveClientPaymentValidator()
    {
        RuleFor(x => x.ClientId).NotEmpty();
        RuleFor(x => x.PaymentId).NotEmpty();
        RuleFor(x => x.Reason).MaximumLength(100);
    }
}
