using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FluentValidation;

namespace FitnessPlatform.Application.Features.SubscriptionPlans.UpdateSubscriptionPlan;

/// <summary>
/// Validates the <see cref="UpdateSubscriptionPlanRequest"/>. <c>Code</c> is not validated
/// here — it is bound from the route and already constrained by the route's own regex (see
/// <see cref="UpdateSubscriptionPlanEndpoint"/>), and it is not an updatable field.
/// </summary>
internal sealed class UpdateSubscriptionPlanValidator : Validator<UpdateSubscriptionPlanRequest>
{
    /// <summary>
    /// Initializes validation rules for subscription plan updates.
    /// </summary>
    public UpdateSubscriptionPlanValidator()
    {
        RuleFor(x => x.NameCs)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .MaximumLength(200).WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.NameEn)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .MaximumLength(200).WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.NameDe)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .MaximumLength(200).WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.ApplicableRoles)
            .IsInEnum().WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.BillingInterval)
            .IsInEnum().WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.Currency)
            .Matches("^[A-Z]{3}$").WithErrorCode(ErrorCodes.OutOfRange)
            .Must(SupportedCurrencies.All.Contains).WithErrorCode(ErrorCodes.UnsupportedCurrency)
            .WithMessage($"Currency must be one of: {string.Join(", ", SupportedCurrencies.All)}.");

        RuleFor(x => x.PriceMinorUnits)
            .GreaterThanOrEqualTo(0).WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.MaxActiveClients)
            .GreaterThanOrEqualTo(1).WithErrorCode(ErrorCodes.OutOfRange)
            .When(x => x.MaxActiveClients.HasValue);
    }
}
