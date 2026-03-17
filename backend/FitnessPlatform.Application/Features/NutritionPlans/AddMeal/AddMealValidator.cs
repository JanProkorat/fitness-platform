using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.NutritionPlans.AddMeal;

/// <summary>
/// Validates the <see cref="AddMealRequest"/>.
/// </summary>
public class AddMealValidator : Validator<AddMealRequest>
{
    /// <summary>
    /// Initializes validation rules for adding a meal to a plan day.
    /// </summary>
    public AddMealValidator()
    {
        RuleFor(x => x.PlanId)
            .NotEmpty();

        RuleFor(x => x.WeekNumber)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.DayOfWeek)
            .InclusiveBetween(1, 7);

        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(100);

        RuleFor(x => x.Order)
            .GreaterThanOrEqualTo(1);
    }
}
