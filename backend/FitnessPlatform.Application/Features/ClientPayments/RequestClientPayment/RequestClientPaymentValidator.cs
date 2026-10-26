using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Services;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientPayments.RequestClientPayment;

/// <summary>
/// Validates the <see cref="RequestClientPaymentRequest"/>.
/// </summary>
internal sealed class RequestClientPaymentValidator : Validator<RequestClientPaymentRequest>
{
    /// <summary>
    /// Initializes validation rules for requesting a payment.
    /// </summary>
    public RequestClientPaymentValidator()
    {
        RuleFor(x => x.ClientId).NotEmpty();
        RuleFor(x => x.PaymentId).NotEmpty();

        RuleFor(x => x.SendEmail)
            .Must((request, _) => request.SendEmail || request.SendNotification)
            .WithErrorCode(ErrorCodes.PaymentRequestChannelRequired)
            .WithMessage("Send the request by email, as a notification, or both.");

        RuleFor(x => x.Amount)
            .Must(amount => amount is > 0 and <= ClientPaymentSchedule.MaxAmount)
            .When(x => x.Amount is not null)
            .WithErrorCode(ErrorCodes.PaymentAmountInvalid)
            .WithMessage("The amount must be above zero and at most 9999999.99.");

        // One day of slack: the endpoint compares against the calendar day in Prague, which can be a day
        // ahead of UTC.
        RuleFor(x => x.DueDate)
            .Must(day => day is { } due && due >= DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-1))
            .When(x => x.DueDate is not null)
            .WithMessage("The due date cannot be in the past.");
    }
}
