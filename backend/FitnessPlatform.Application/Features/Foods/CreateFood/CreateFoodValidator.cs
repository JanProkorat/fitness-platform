using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.Foods.Shared;

namespace FitnessPlatform.Application.Features.Foods.CreateFood;

/// <summary>
/// Validates the <see cref="CreateFoodRequest"/>.
/// </summary>
public class CreateFoodValidator : Validator<CreateFoodRequest>
{
    /// <summary>
    /// Initializes validation rules for custom food creation.
    /// </summary>
    public CreateFoodValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.Barcode)
            .MaximumLength(50)
            .When(x => x.Barcode is not null);

        RuleFor(x => x.NutrientValue.Kcal)
            .GreaterThanOrEqualTo(0);

        RuleFor(x => x.NutrientValue.Protein)
            .GreaterThanOrEqualTo(0);

        RuleFor(x => x.NutrientValue.Carbs)
            .GreaterThanOrEqualTo(0);

        RuleFor(x => x.NutrientValue.Fat)
            .GreaterThanOrEqualTo(0);

        RuleFor(x => x.NutrientValue)
            .Must(n => NutrientValidation.IsKcalConsistent(n.Kcal, n.Protein, n.Carbs, n.Fat))
            .WithErrorCode(ErrorCodes.KcalInconsistent)
            .WithMessage("Kcal value is not consistent with macronutrients (protein×4 + carbs×4 + fat×9 ± 10%).");

        RuleForEach(x => x.CommonServings).ChildRules(s =>
        {
            s.RuleFor(x => x.Label).NotEmpty().MaximumLength(100);
            s.RuleFor(x => x.WeightGrams).GreaterThan(0);
        });
    }
}
