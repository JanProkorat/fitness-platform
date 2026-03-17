using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientNutrition.LogMealEaten;

/// <summary>
/// Validator for the <see cref="LogMealEatenRequest"/>.
/// </summary>
public class LogMealEatenValidator : Validator<LogMealEatenRequest>
{
    /// <summary>
    /// Initializes validation rules for the log meal eaten request.
    /// </summary>
    public LogMealEatenValidator()
    {
        RuleFor(x => x.MealId)
            .NotEmpty()
            .WithMessage("MealId is required.");
    }
}
