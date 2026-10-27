using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientNutrition.SetShoppingListItemTicked;

/// <summary>
/// Validates the <see cref="SetShoppingListItemTickedRequest"/>.
/// </summary>
public class SetShoppingListItemTickedValidator : Validator<SetShoppingListItemTickedRequest>
{
    /// <summary>
    /// Initializes validation rules for ticking a shopping-list item.
    /// </summary>
    public SetShoppingListItemTickedValidator()
    {
        RuleFor(x => x.WeekNumber)
            .GreaterThanOrEqualTo(1);

        RuleFor(x => x.FoodExternalId)
            .NotEmpty();
    }
}
