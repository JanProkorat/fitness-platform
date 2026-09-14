using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FluentValidation;

namespace FitnessPlatform.Application.Features.SubscriptionPlans.DeactivateSubscriptionPlan;

/// <summary>
/// Validates the <see cref="DeactivateSubscriptionPlanRequest"/>. <c>Code</c> is bound from
/// the route; the route no longer carries a regex constraint (see
/// <see cref="DeactivateSubscriptionPlanEndpoint"/>), so the wire-format check lives here.
/// </summary>
internal sealed class DeactivateSubscriptionPlanValidator : Validator<DeactivateSubscriptionPlanRequest>
{
    /// <summary>
    /// Initializes validation rules for subscription plan deactivation.
    /// </summary>
    public DeactivateSubscriptionPlanValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .MaximumLength(50).WithErrorCode(ErrorCodes.OutOfRange)
            .Matches("^[a-z0-9-]+$").WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage("Code must be 1-50 lowercase letters, digits, or hyphens.");
    }
}
