using FastEndpoints;
using FitnessPlatform.Application.Domain.Extensions;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientNutrition.AddOffPlanFood;

/// <summary>
/// Validates the <see cref="AddOffPlanFoodRequest"/>.
/// </summary>
public class AddOffPlanFoodValidator : Validator<AddOffPlanFoodRequest>
{
    /// <summary>Upper bound for one entry, in grams.</summary>
    public const decimal MaxAmountGrams = 10000m;

    /// <summary>
    /// Initializes validation rules for logging an off-plan food.
    /// </summary>
    public AddOffPlanFoodValidator()
    {
        RuleFor(x => x.FoodExternalId)
            .NotEmpty();

        RuleFor(x => x.AmountGrams)
            .GreaterThan(0)
            .LessThanOrEqualTo(MaxAmountGrams);

        RuleFor(x => x.EntryId)
            .NotEqual(Guid.Empty)
            .When(x => x.EntryId.HasValue);

        this.AddOfflineSyncRules(x => x.OccurredAt, x => x.ClientRequestId);
    }
}
