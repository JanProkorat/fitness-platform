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
    /// The maximum number of tags a single food may carry.
    /// </summary>
    private const int MaxTags = 20;

    /// <summary>
    /// The maximum length of a single tag.
    /// </summary>
    private const int MaxTagLength = 40;

    /// <summary>
    /// Initializes validation rules for custom food creation.
    /// </summary>
    public CreateFoodValidator()
    {
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

        RuleFor(x => x.NutrientValue)
            .Must(n => NutrientValidation.IsKcalConsistent(n.Kcal, n.Protein, n.Carbs, n.Fat))
            .WithErrorCode(ErrorCodes.KcalInconsistent)
            .WithMessage("Kcal value is not consistent with macronutrients (protein×4 + carbs×4 + fat×9 ± 10%).");

        RuleFor(x => x.CommonServings)
            .NotEmpty()
            .WithMessage("At least one common serving is required — the first entry is used as the default serving.");

        RuleForEach(x => x.CommonServings).ChildRules(s =>
        {
            s.RuleFor(x => x.Label).NotEmpty().MaximumLength(100);
            s.RuleFor(x => x.WeightGrams).GreaterThan(0);
        });

        RuleFor(x => x.Visibility).IsInEnum();

        RuleForEach(x => x.Allergens).IsInEnum();

        RuleForEach(x => x.DietaryPreferences).IsInEnum();

        // No CascadeMode is configured anywhere in this backend (default: Continue), so the
        // Must() below still runs after NotNull() fails — it guards `tags is null` itself rather
        // than relying on cascade-stop to short-circuit a null Tags before it reaches Count.
        RuleFor(x => x.Tags)
            .NotNull()
            .WithMessage("Tags must not be null.")
            .Must(tags => tags is null || tags.Count <= MaxTags)
            .WithMessage($"At most {MaxTags} tags may be supplied.");

        RuleForEach(x => x.Tags)
            .NotEmpty()
            .WithMessage("A tag must not be blank.")
            .MaximumLength(MaxTagLength)
            .WithMessage($"A tag must be at most {MaxTagLength} characters.")
            .Must(tag => !tag.Contains(','))
            .WithMessage("A tag must not contain a comma.");
    }
}
