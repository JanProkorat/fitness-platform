using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.NutritionPlans.UpdatePlan;

/// <summary>
/// Validates the <see cref="UpdatePlanRequest"/>.
/// </summary>
public class UpdatePlanValidator : Validator<UpdatePlanRequest>
{
    /// <summary>
    /// Initializes validation rules for updating a nutrition plan.
    /// </summary>
    public UpdatePlanValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.Version)
            .GreaterThanOrEqualTo(1);
    }
}
