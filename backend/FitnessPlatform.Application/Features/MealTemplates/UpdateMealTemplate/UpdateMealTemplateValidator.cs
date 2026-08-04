using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FluentValidation;

namespace FitnessPlatform.Application.Features.MealTemplates.UpdateMealTemplate;

/// <summary>
/// Validates the <see cref="UpdateMealTemplateRequest"/>.
/// </summary>
internal sealed class UpdateMealTemplateValidator : Validator<UpdateMealTemplateRequest>
{
    /// <summary>
    /// Initializes validation rules for meal template updates.
    /// </summary>
    public UpdateMealTemplateValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .MaximumLength(200).WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.Description)
            .MaximumLength(2000).WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.Kind)
            .IsInEnum().WithErrorCode(ErrorCodes.OutOfRange)
            .When(x => x.Kind.HasValue);

        RuleFor(x => x.Visibility)
            .IsInEnum().WithErrorCode(ErrorCodes.OutOfRange);

        RuleForEach(x => x.Foods).ChildRules(food =>
        {
            food.RuleFor(f => f.FoodExternalId)
                .NotEmpty().WithErrorCode(ErrorCodes.Required);

            food.RuleFor(f => f.AmountGrams)
                .GreaterThan(0).WithErrorCode(ErrorCodes.OutOfRange);
        });

        RuleForEach(x => x.Recipes).ChildRules(recipe =>
        {
            recipe.RuleFor(r => r.RecipeId)
                .NotEmpty().WithErrorCode(ErrorCodes.Required);

            recipe.RuleFor(r => r.Servings)
                .GreaterThan(0).WithErrorCode(ErrorCodes.OutOfRange);
        });
    }
}
