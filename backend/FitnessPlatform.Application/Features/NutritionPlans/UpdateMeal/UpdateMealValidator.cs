using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.NutritionPlans.UpdateMeal;

/// <summary>
/// Validates the <see cref="UpdateMealRequest"/>.
/// </summary>
public class UpdateMealValidator : Validator<UpdateMealRequest>
{
    /// <summary>
    /// Initializes validation rules for updating a meal in a plan day.
    /// </summary>
    public UpdateMealValidator()
    {
        RuleFor(x => x.PlanId)
            .NotEmpty();

        RuleFor(x => x.WeekNumber)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.DayOfWeek)
            .InclusiveBetween(1, 7);

        RuleFor(x => x.MealId)
            .NotEmpty();

        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(100);

        RuleFor(x => x.Order)
            .GreaterThanOrEqualTo(1);
    }
}
