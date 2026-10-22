using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FitnessPlatform.Application.Domain.Services;
using FluentValidation;

namespace FitnessPlatform.Application.Features.CoachPackages.Shared;

/// <summary>
/// Input rules common to creating and updating a coach package.
/// </summary>
/// <typeparam name="TRequest">The create or update request.</typeparam>
public abstract class CoachPackageInputValidator<TRequest> : Validator<TRequest>
    where TRequest : ICoachPackageInput
{
    /// <summary>
    /// Initializes validation rules for a coach package's editable fields.
    /// </summary>
    protected CoachPackageInputValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .MaximumLength(100).WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.Description)
            .MaximumLength(500).WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.Currency)
            .IsInEnum().WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.Price)
            .GreaterThan(0).WithErrorCode(ErrorCodes.OutOfRange)
            .Must((request, price) => price <= CoachPackagePricing.MaxPrice(request.Currency)).WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage("Price is above the limit of its currency.")
            .Must(price => decimal.Round(price, 2) == price).WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage("Price can have at most 2 decimals.");

        RuleFor(x => x.Billing)
            .IsInEnum().WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.IntervalWeeks)
            .NotNull().WithErrorCode(ErrorCodes.Required)
            .InclusiveBetween(1, 52).WithErrorCode(ErrorCodes.OutOfRange)
            .When(x => x.Billing == PackageBillingInterval.EveryNWeeks);

        RuleFor(x => x.IntervalWeeks)
            .Null().WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage("Interval weeks applies only to packages billed every N weeks.")
            .When(x => x.Billing != PackageBillingInterval.EveryNWeeks);

        RuleFor(x => x.RunsForPayments)
            .Null().WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage("A one-off package has no payment count.")
            .When(x => x.Billing == PackageBillingInterval.OneOff);

        RuleFor(x => x.RunsForPayments)
            .InclusiveBetween(1, 120).WithErrorCode(ErrorCodes.OutOfRange)
            .When(x => x.RunsForPayments.HasValue);

        RuleFor(x => x.PaymentDueDaysOverride)
            .InclusiveBetween(1, 90).WithErrorCode(ErrorCodes.OutOfRange)
            .When(x => x.PaymentDueDaysOverride.HasValue);
    }
}
