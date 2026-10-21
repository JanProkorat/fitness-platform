using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Discounts.Shared;

/// <summary>
/// Input rules common to creating and updating a coach discount.
/// </summary>
/// <typeparam name="TRequest">The create or update request.</typeparam>
public abstract class CoachDiscountInputValidator<TRequest> : Validator<TRequest>
    where TRequest : ICoachDiscountInput
{
    /// <summary>
    /// Initializes validation rules for a coach discount's editable fields.
    /// </summary>
    protected CoachDiscountInputValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .MaximumLength(100).WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.Type)
            .IsInEnum().WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.Value)
            .InclusiveBetween(1m, 100m).WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage("A percentage discount must be between 1 and 100.")
            .When(x => x.Type == DiscountType.Percentage);

        RuleFor(x => x.Value)
            .GreaterThan(0).WithErrorCode(ErrorCodes.OutOfRange)
            .LessThanOrEqualTo(1_000_000m).WithErrorCode(ErrorCodes.OutOfRange)
            .When(x => x.Type == DiscountType.FixedAmount);

        RuleFor(x => x.Value)
            .Must(value => decimal.Round(value, 2) == value).WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage("Value can have at most 2 decimals.");

        RuleFor(x => x.Duration)
            .IsInEnum().WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.DurationPayments)
            .NotNull().WithErrorCode(ErrorCodes.Required)
            .InclusiveBetween(1, 120).WithErrorCode(ErrorCodes.OutOfRange)
            .When(x => x.Duration == DiscountDuration.FirstPayments);

        RuleFor(x => x.DurationPayments)
            .Null().WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage("A payment count applies only to first-N-payments discounts.")
            .When(x => x.Duration != DiscountDuration.FirstPayments);

        RuleFor(x => x.ValidTo)
            .Must((request, validTo) => validTo!.Value >= request.ValidFrom!.Value).WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage("The end date cannot be before the start date.")
            .When(x => x.ValidFrom.HasValue && x.ValidTo.HasValue);

        RuleFor(x => x.PackageIds)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .WithMessage("Choose at least one package, or apply the discount to all packages.")
            .When(x => !x.AppliesToAllPackages);
    }
}
