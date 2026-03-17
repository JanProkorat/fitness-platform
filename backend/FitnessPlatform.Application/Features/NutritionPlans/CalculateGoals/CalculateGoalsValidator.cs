using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.NutritionPlans.CalculateGoals;

/// <summary>
/// Validator for <see cref="CalculateGoalsRequest"/>.
/// </summary>
public class CalculateGoalsValidator : Validator<CalculateGoalsRequest>
{
    /// <summary>
    /// Initializes validation rules for the calculate goals request.
    /// </summary>
    public CalculateGoalsValidator()
    {
        RuleFor(x => x.ClientId).NotEmpty();
        RuleFor(x => x.WeightKg).GreaterThan(0);
        RuleFor(x => x.HeightCm).GreaterThan(0);
        RuleFor(x => x.Age).InclusiveBetween(1, 120);
        RuleFor(x => x.Sex).IsInEnum();
        RuleFor(x => x.ActivityLevel).IsInEnum();
        RuleFor(x => x.Goal).IsInEnum();
        RuleFor(x => x.ProteinPercent).InclusiveBetween(0, 100);
        RuleFor(x => x.CarbsPercent).InclusiveBetween(0, 100);
        RuleFor(x => x.FatPercent).InclusiveBetween(0, 100);
        RuleFor(x => x)
            .Must(x => x.ProteinPercent + x.CarbsPercent + x.FatPercent == 100)
            .WithMessage("Macro percentages must sum to 100.");
    }
}
