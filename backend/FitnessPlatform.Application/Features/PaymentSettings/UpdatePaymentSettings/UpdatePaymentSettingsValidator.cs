using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FluentValidation;

namespace FitnessPlatform.Application.Features.PaymentSettings.UpdatePaymentSettings;

/// <summary>
/// Validates the <see cref="UpdatePaymentSettingsRequest"/>.
/// </summary>
internal sealed class UpdatePaymentSettingsValidator : Validator<UpdatePaymentSettingsRequest>
{
    /// <summary>
    /// Initializes validation rules for updating payment settings.
    /// </summary>
    public UpdatePaymentSettingsValidator()
    {
        RuleFor(x => x.PaymentDueDays)
            .InclusiveBetween(1, 90).WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage("Payment due days must be between 1 and 90.");

        RuleFor(x => x.MessageFormat)
            .IsInEnum().WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.VariableSymbolFormat)
            .IsInEnum().WithErrorCode(ErrorCodes.OutOfRange);
    }
}
