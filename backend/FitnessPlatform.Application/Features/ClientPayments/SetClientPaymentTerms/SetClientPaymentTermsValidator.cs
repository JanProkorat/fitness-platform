using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Services;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientPayments.SetClientPaymentTerms;

/// <summary>
/// Validates the <see cref="SetClientPaymentTermsRequest"/>.
/// </summary>
internal sealed class SetClientPaymentTermsValidator : Validator<SetClientPaymentTermsRequest>
{
    /// <summary>
    /// Initializes validation rules for setting a client's terms.
    /// </summary>
    public SetClientPaymentTermsValidator()
    {
        RuleFor(x => x.ClientId).NotEmpty();
        RuleFor(x => x.PackageId).NotEmpty();

        RuleFor(x => x.DiscountId)
            .Null()
            .When(x => x.CustomPrice is not null)
            .WithErrorCode(ErrorCodes.PaymentTermsDiscountAndCustomPrice)
            .WithMessage("A client has either a discount or a custom price, not both.");

        RuleFor(x => x.CustomPrice)
            .Must(price => price is > 0 and <= ClientPaymentSchedule.MaxAmount)
            .When(x => x.CustomPrice is not null)
            .WithErrorCode(ErrorCodes.PaymentAmountInvalid)
            .WithMessage("The custom price must be above zero and at most 9999999.99.");

        RuleFor(x => x.FirstPeriodStart)
            .Must(start => start is { } day && day >= Today().AddDays(-1) && day <= Today().AddDays(366))
            .When(x => x.FirstPeriodStart is not null)
            .WithErrorCode(ErrorCodes.PaymentStartDateInvalid)
            .WithMessage("The first period must start between today and a year from now.");
    }

    private static DateOnly Today() => DateOnly.FromDateTime(DateTime.UtcNow);
}
