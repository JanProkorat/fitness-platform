using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.NutritionPlans.UpdateDay;

/// <summary>
/// Validates the <see cref="UpdateDayRequest"/>.
/// </summary>
public class UpdateDayValidator : Validator<UpdateDayRequest>
{
    /// <summary>
    /// Initializes validation rules for updating a plan day.
    /// </summary>
    public UpdateDayValidator()
    {
        RuleFor(x => x.PlanId)
            .NotEmpty();

        RuleFor(x => x.WeekNumber)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.DayOfWeek)
            .InclusiveBetween(1, 7);
    }
}
