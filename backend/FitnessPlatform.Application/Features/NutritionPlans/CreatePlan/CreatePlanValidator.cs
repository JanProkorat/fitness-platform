using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.NutritionPlans.CreatePlan;

/// <summary>
/// Validates the <see cref="CreatePlanRequest"/>.
/// </summary>
public class CreatePlanValidator : Validator<CreatePlanRequest>
{
    /// <summary>
    /// Initializes validation rules for creating a nutrition plan.
    /// </summary>
    public CreatePlanValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.ClientId)
            .NotEmpty();

        RuleFor(x => x.WeekCount)
            .InclusiveBetween(1, 52);
    }
}
