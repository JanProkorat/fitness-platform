using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Client.Plans.GetClientPlanSummary;

/// <summary>
/// Validates the <see cref="GetClientPlanSummaryRequest"/>.
/// </summary>
public class GetClientPlanSummaryValidator : Validator<GetClientPlanSummaryRequest>
{
    /// <summary>
    /// Initializes validation rules for the plan summary request.
    /// </summary>
    public GetClientPlanSummaryValidator()
    {
        RuleFor(x => x.PlanId).NotEmpty();
    }
}
