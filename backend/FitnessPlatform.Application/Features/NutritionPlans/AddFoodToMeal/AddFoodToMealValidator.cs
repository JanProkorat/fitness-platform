using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.NutritionPlans.AddFoodToMeal;

/// <summary>
/// Validates the <see cref="AddFoodToMealRequest"/>.
/// </summary>
public class AddFoodToMealValidator : Validator<AddFoodToMealRequest>
{
    /// <summary>
    /// Initializes validation rules for adding a food to a meal.
    /// </summary>
    public AddFoodToMealValidator()
    {
        RuleFor(x => x.PlanId)
            .NotEmpty();

        RuleFor(x => x.MealId)
            .NotEmpty();

        RuleFor(x => x.FoodExternalId)
            .NotEmpty();

        RuleFor(x => x.AmountGrams)
            .GreaterThan(0)
            .LessThanOrEqualTo(10000);
    }
}
