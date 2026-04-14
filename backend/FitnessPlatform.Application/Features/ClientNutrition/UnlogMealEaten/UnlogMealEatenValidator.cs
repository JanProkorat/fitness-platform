using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientNutrition.UnlogMealEaten;

/// <summary>
/// Validator for the <see cref="UnlogMealEatenRequest"/>.
/// </summary>
public class UnlogMealEatenValidator : Validator<UnlogMealEatenRequest>
{
    /// <summary>
    /// Initializes validation rules for the unlog meal eaten request.
    /// </summary>
    public UnlogMealEatenValidator()
    {
        RuleFor(x => x.MealId)
            .NotEmpty()
            .WithMessage("MealId is required.");
    }
}
