using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Recipes.CreateRecipe;

/// <summary>
/// Validates the <see cref="CreateRecipeRequest"/>.
/// </summary>
public class CreateRecipeValidator : Validator<CreateRecipeRequest>
{
    /// <summary>
    /// Initializes validation rules for recipe creation.
    /// </summary>
    public CreateRecipeValidator()
    {
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
    }
}
