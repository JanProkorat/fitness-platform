using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientNutrition.GetShoppingList;

/// <summary>
/// Validator for <see cref="GetShoppingListRequest"/>.
/// </summary>
public class GetShoppingListValidator : Validator<GetShoppingListRequest>
{
    /// <summary>
    /// Initializes validation rules for the shopping list request.
    /// </summary>
    public GetShoppingListValidator()
    {
        RuleFor(x => x.WeekFrom).GreaterThanOrEqualTo(1);
        RuleFor(x => x.WeekTo).GreaterThanOrEqualTo(x => x.WeekFrom)
            .When(x => x.WeekTo.HasValue);
    }
}
