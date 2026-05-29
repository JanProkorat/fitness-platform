using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.NutritionPlans.UpdatePlan;

/// <summary>
/// Validates <see cref="UpdatePlanRequest"/> including all nested weeks, days, meals, foods, and supplements.
/// </summary>
public class UpdatePlanValidator : Validator<UpdatePlanRequest>
{
    /// <summary>
    /// Initializes validation rules for a full-state nutrition plan update.
    /// </summary>
    public UpdatePlanValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.Version)
            .GreaterThanOrEqualTo(1);

        RuleForEach(x => x.Supplements).ChildRules(supplement =>
        {
            supplement.RuleFor(s => s.Name)
                .NotEmpty().WithMessage("Supplement Name must not be empty.")
                .MaximumLength(100).WithMessage("Supplement Name must not exceed 100 characters.");

            supplement.RuleFor(s => s.Dose)
                .MaximumLength(200).WithMessage("Supplement Dose must not exceed 200 characters.")
                .When(s => s.Dose is not null);

            supplement.RuleFor(s => s.Notes)
                .MaximumLength(500).WithMessage("Supplement Notes must not exceed 500 characters.")
                .When(s => s.Notes is not null);
        });

        RuleFor(x => x.Weeks)
            .NotEmpty().WithMessage("At least one week is required.")
            .Must(weeks => weeks.Count <= 52).WithMessage("A plan may not exceed 52 weeks.")
            .Must(weeks => weeks.Select(w => w.WeekNumber).Distinct().Count() == weeks.Count)
                .WithMessage("Duplicate WeekNumber values are not allowed.");

        RuleForEach(x => x.Weeks).ChildRules(week =>
        {
            week.RuleFor(w => w.WeekNumber)
                .GreaterThanOrEqualTo(1).WithMessage("WeekNumber must be >= 1.");

            week.RuleFor(w => w.Days)
                .Must(days => days.Select(d => d.DayOfWeek).Distinct().Count() == days.Count)
                    .WithMessage("Duplicate DayOfWeek values are not allowed within a week.");

            week.RuleForEach(w => w.Days).ChildRules(day =>
            {
                day.RuleFor(d => d.DayOfWeek)
                    .InclusiveBetween(1, 7).WithMessage("DayOfWeek must be between 1 and 7.");

                day.RuleFor(d => d.Meals)
                    .Must(meals => meals.Count <= 20).WithMessage("A day may not have more than 20 meals.")
                    .Must(meals =>
                    {
                        var withId = meals.Where(m => m.MealId.HasValue).Select(m => m.MealId!.Value).ToList();
                        return withId.Distinct().Count() == withId.Count;
                    }).WithMessage("Duplicate MealId values are not allowed within a day.");

                day.RuleForEach(d => d.Meals).ChildRules(meal =>
                {
                    meal.RuleFor(m => m.Kind)
                        .IsInEnum();

                    meal.RuleFor(m => m.Order)
                        .GreaterThanOrEqualTo(1).WithMessage("Meal Order must be >= 1.");

                    meal.RuleFor(m => m.Foods)
                        .Must(foods => foods.Count <= 50).WithMessage("A meal may not have more than 50 foods.");

                    meal.RuleForEach(m => m.Foods).ChildRules(food =>
                    {
                        food.RuleFor(f => f.FoodExternalId)
                            .NotEmpty().WithMessage("FoodExternalId must not be empty.");

                        food.RuleFor(f => f.FoodName)
                            .NotEmpty().WithMessage("FoodName must not be empty.");

                        food.RuleFor(f => f.AmountGrams)
                            .GreaterThan(0).WithMessage("AmountGrams must be > 0.")
                            .LessThanOrEqualTo(10000).WithMessage("AmountGrams must be <= 10000.");
                    });
                });
            });
        });
    }
}
