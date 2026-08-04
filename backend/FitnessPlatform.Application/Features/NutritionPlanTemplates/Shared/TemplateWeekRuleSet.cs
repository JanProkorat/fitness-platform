using FitnessPlatform.Application.Domain.Constants;
using FluentValidation;

namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.Shared;

/// <summary>
/// Shared per-week/day/meal/food validation rules for <see cref="TemplateWeekRequest"/>. Applied
/// identically by <c>CreateTemplateValidator</c> (when a caller-supplied week tree is provided,
/// guarded by its own mutual-exclusion-with-<c>WeekCount</c> condition) and
/// <c>UpdateTemplateValidator</c> (always, since <c>Weeks</c> is required there) so the two
/// validators cannot drift on the shape they both accept. The distinct-<c>WeekNumber</c>-across-
/// the-list check is NOT part of this fragment — it needs sibling access across the whole
/// <c>Weeks</c> collection, so each caller applies it separately at the list level.
/// </summary>
internal static class TemplateWeekRuleSet
{
    /// <summary>
    /// Configures the nested week/day/meal/food rules on a <see cref="TemplateWeekRequest"/>
    /// child validator.
    /// </summary>
    public static void Configure(InlineValidator<TemplateWeekRequest> week)
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
    }
}
