using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FluentValidation;

namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.UpdateTemplate;

/// <summary>
/// Validates <see cref="UpdateTemplateRequest"/>, including all nested weeks, days, meals,
/// foods, recipes, and supplements. Mirrors <c>UpdatePlanValidator</c>'s structure — same
/// content tree, same duplicate-<c>MealId</c>-per-day hazard.
/// </summary>
public class UpdateTemplateValidator : Validator<UpdateTemplateRequest>
{
    /// <summary>
    /// Initializes validation rules for a full-state nutrition plan template update.
    /// </summary>
    public UpdateTemplateValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .MaximumLength(200).WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.Description)
            .MaximumLength(2000).WithErrorCode(ErrorCodes.OutOfRange)
            .When(x => x.Description is not null);

        RuleFor(x => x.Version)
            .GreaterThanOrEqualTo(1).WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.Goal)
            .IsInEnum().WithErrorCode(ErrorCodes.OutOfRange)
            .When(x => x.Goal.HasValue);

        RuleFor(x => x.DietaryStyle)
            .IsInEnum().WithErrorCode(ErrorCodes.OutOfRange)
            .When(x => x.DietaryStyle.HasValue);

        RuleForEach(x => x.Supplements).ChildRules(supplement =>
        {
            supplement.RuleFor(s => s.Name)
                .NotEmpty().WithErrorCode(ErrorCodes.Required)
                .MaximumLength(100).WithErrorCode(ErrorCodes.OutOfRange);

            supplement.RuleFor(s => s.Dose)
                .MaximumLength(200).WithErrorCode(ErrorCodes.OutOfRange)
                .When(s => s.Dose is not null);

            supplement.RuleFor(s => s.Notes)
                .MaximumLength(500).WithErrorCode(ErrorCodes.OutOfRange)
                .When(s => s.Notes is not null);
        });

        RuleFor(x => x.Weeks)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .Must(weeks => weeks.Count <= 52).WithErrorCode(ErrorCodes.OutOfRange)
            .Must(weeks => weeks.Select(w => w.WeekNumber).Distinct().Count() == weeks.Count)
                .WithErrorCode(ErrorCodes.OutOfRange);

        RuleForEach(x => x.Weeks).ChildRules(week =>
        {
            week.RuleFor(w => w.WeekNumber)
                .GreaterThanOrEqualTo(1).WithErrorCode(ErrorCodes.OutOfRange);

            week.RuleFor(w => w.Days)
                .Must(days => days.Select(d => d.DayOfWeek).Distinct().Count() == days.Count)
                    .WithErrorCode(ErrorCodes.OutOfRange);

            week.RuleForEach(w => w.Days).ChildRules(day =>
            {
                day.RuleFor(d => d.DayOfWeek)
                    .InclusiveBetween(1, 7).WithErrorCode(ErrorCodes.OutOfRange);

                day.RuleFor(d => d.Meals)
                    .Must(meals => meals.Count <= 20).WithErrorCode(ErrorCodes.OutOfRange)
                    .Must(meals =>
                    {
                        var withId = meals.Where(m => m.MealId.HasValue).Select(m => m.MealId!.Value).ToList();
                        return withId.Distinct().Count() == withId.Count;
                    }).WithErrorCode(ErrorCodes.OutOfRange)
                    .WithMessage("Duplicate MealId values are not allowed within a day.");

                day.RuleForEach(d => d.Meals).ChildRules(meal =>
                {
                    meal.RuleFor(m => m.Kind).IsInEnum().WithErrorCode(ErrorCodes.OutOfRange);

                    meal.RuleFor(m => m.Order)
                        .GreaterThanOrEqualTo(1).WithErrorCode(ErrorCodes.OutOfRange);

                    meal.RuleFor(m => m.Foods)
                        .Must(foods => foods.Count <= 50).WithErrorCode(ErrorCodes.OutOfRange);

                    meal.RuleForEach(m => m.Foods).ChildRules(food =>
                    {
                        food.RuleFor(f => f.FoodExternalId)
                            .NotEmpty().WithErrorCode(ErrorCodes.Required);

                        food.RuleFor(f => f.FoodName)
                            .NotEmpty().WithErrorCode(ErrorCodes.Required);

                        food.RuleFor(f => f.AmountGrams)
                            .GreaterThan(0).WithErrorCode(ErrorCodes.OutOfRange)
                            .LessThanOrEqualTo(10000).WithErrorCode(ErrorCodes.OutOfRange);
                    });
                });
            });
        });
    }
}
