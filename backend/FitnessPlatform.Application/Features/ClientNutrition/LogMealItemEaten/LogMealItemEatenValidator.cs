using FastEndpoints;
using FitnessPlatform.Application.Domain.Extensions;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientNutrition.LogMealItemEaten;

/// <summary>
/// Validator for the <see cref="LogMealItemEatenRequest"/>.
/// </summary>
public class LogMealItemEatenValidator : Validator<LogMealItemEatenRequest>
{
    /// <summary>
    /// Initializes validation rules for marking a meal item as eaten.
    /// </summary>
    public LogMealItemEatenValidator()
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
