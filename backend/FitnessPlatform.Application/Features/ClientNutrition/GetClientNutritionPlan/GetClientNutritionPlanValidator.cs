using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientNutrition.GetClientNutritionPlan;

/// <summary>
/// Validates the <see cref="GetClientNutritionPlanRequest"/>.
/// </summary>
public class GetClientNutritionPlanValidator : Validator<GetClientNutritionPlanRequest>
{
    /// <summary>
    /// Initializes validation rules for fetching one of the caller's nutrition plans.
    /// </summary>
    public GetClientNutritionPlanValidator()
    {
        RuleFor(x => x.PlanId).NotEmpty();
    }
}
