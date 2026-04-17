using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Recipes.UpdateRecipe;

/// <summary>
/// Validates the <see cref="UpdateRecipeRequest"/>.
/// </summary>
public class UpdateRecipeValidator : Validator<UpdateRecipeRequest>
{
    /// <summary>
    /// Initializes validation rules for recipe update.
    /// </summary>
    public UpdateRecipeValidator()
    {
        RuleFor(x => x.RecipeId)
            .NotEmpty();

        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.Description)
            .MaximumLength(5000);

        RuleFor(x => x.Foods)
            .NotEmpty()
            .WithMessage("A recipe must contain at least one food item.");

        RuleForEach(x => x.Foods).ChildRules(food =>
        {
            food.RuleFor(f => f.FoodExternalId)
                .NotEmpty();

            food.RuleFor(f => f.AmountGrams)
                .GreaterThan(0);
        });

        RuleFor(x => x.Visibility).IsInEnum();
    }
}
