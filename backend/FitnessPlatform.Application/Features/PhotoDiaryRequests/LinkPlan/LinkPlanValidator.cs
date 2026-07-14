using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.PhotoDiaryRequests.LinkPlan;

/// <summary>
/// Validates <see cref="LinkPlanRequest"/> before the endpoint handler executes.
/// </summary>
public class LinkPlanValidator : Validator<LinkPlanRequest>
{
    public LinkPlanValidator()
    {
        RuleFor(x => x.RequestId)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.Required)
            .WithMessage("RequestId is required.");

        RuleFor(x => x.PlanId)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.Required)
            .WithMessage("PlanId is required.");
    }
}
