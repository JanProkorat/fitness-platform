using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.Foods.Shared;

namespace FitnessPlatform.Application.Features.Foods.UpdateFood;

/// <summary>
/// Validates the <see cref="UpdateFoodRequest"/>.
/// </summary>
public class UpdateFoodValidator : Validator<UpdateFoodRequest>
{
    /// <summary>
    /// Initializes validation rules for food update.
    /// </summary>
    public UpdateFoodValidator()
    {
        RuleFor(x => x.FoodId)
            .NotEmpty();

        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.NutrientValue.Kcal)
            .GreaterThanOrEqualTo(0);

        RuleFor(x => x.NutrientValue.Protein)
            .GreaterThanOrEqualTo(0);

        RuleFor(x => x.NutrientValue.Carbs)
            .GreaterThanOrEqualTo(0);

        RuleFor(x => x.NutrientValue.Fat)
            .GreaterThanOrEqualTo(0);

        RuleFor(x => x.NutrientValue.Fiber)
            .GreaterThanOrEqualTo(0)
            .When(x => x.NutrientValue.Fiber.HasValue);

        RuleFor(x => x.NutrientValue)
            .Must(n => NutrientValidation.IsKcalConsistent(n.Kcal, n.Protein, n.Carbs, n.Fat, n.Fiber))
            .WithErrorCode(ErrorCodes.KcalInconsistent)
            .WithMessage("Kcal value is not consistent with macronutrients (protein×4 + carbs×4 + fat×9 + fibre×2 ± 10%).");

        RuleFor(x => x.CommonServings)
            .NotEmpty()
            .WithMessage("At least one common serving is required — the first entry is used as the default serving.");

        RuleForEach(x => x.CommonServings).ChildRules(s =>
        {
            s.RuleFor(x => x.Label).NotEmpty().MaximumLength(100);
            s.RuleFor(x => x.WeightGrams).GreaterThan(0);
        });

        RuleFor(x => x.Visibility)
            .Must(v => !v.HasValue || Enum.IsDefined(v.Value))
            .WithMessage("Visibility must be a valid enum value.");

        RuleForEach(x => x.Allergens).IsInEnum();

        RuleForEach(x => x.DietaryPreferences).IsInEnum();
    }
}
