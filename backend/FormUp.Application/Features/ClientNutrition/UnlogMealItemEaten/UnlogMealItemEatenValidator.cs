using FastEndpoints;
using FormUp.Application.Domain.Extensions;
using FluentValidation;

namespace FormUp.Application.Features.ClientNutrition.UnlogMealItemEaten;

/// <summary>
/// Validator for the <see cref="UnlogMealItemEatenRequest"/>.
/// </summary>
public class UnlogMealItemEatenValidator : Validator<UnlogMealItemEatenRequest>
{
    /// <summary>
    /// Initializes validation rules for unmarking a meal item.
    /// </summary>
    public UnlogMealItemEatenValidator()
    {
        RuleFor(x => x.MealId)
            .NotEmpty()
            .WithMessage("MealId is required.");

        RuleFor(x => x.ItemId)
            .NotEmpty()
            .WithMessage("ItemId is required.");

        this.AddOfflineSyncRules(x => x.OccurredAt, x => x.ClientRequestId);
    }
}
