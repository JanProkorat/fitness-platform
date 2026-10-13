using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Trainers.UpdateClientNutritionProfile;

/// <summary>
/// Validates the <see cref="UpdateClientNutritionProfileRequest"/>.
/// </summary>
public class UpdateClientNutritionProfileValidator : Validator<UpdateClientNutritionProfileRequest>
{
    private const int MaxItems = 20;
    private const int MaxItemLength = 60;
    private const int MaxAllergiesLength = 200;

    /// <summary>
    /// Initializes validation rules for editing a client's nutrition profile.
    /// </summary>
    public UpdateClientNutritionProfileValidator()
    {
        RuleFor(x => x.ClientId).NotEmpty();

        RuleFor(x => x.Dislikes)
            .NotNull()
            .Must(items => items is null || items.Count <= MaxItems)
            .WithMessage($"At most {MaxItems} dislikes are allowed.");
        RuleForEach(x => x.Dislikes)
            .Must(IsValidItem)
            .WithMessage($"Each dislike must be 1-{MaxItemLength} characters and not blank.");

        RuleFor(x => x.Habits)
            .NotNull()
            .Must(items => items is null || items.Count <= MaxItems)
            .WithMessage($"At most {MaxItems} habits are allowed.");
        RuleForEach(x => x.Habits)
            .Must(IsValidItem)
            .WithMessage($"Each habit must be 1-{MaxItemLength} characters and not blank.");

        RuleFor(x => x.Allergies)
            .NotNull()
            .Must(items => items is null || string.Join(",", items).Length <= MaxAllergiesLength)
            .WithMessage($"Allergies must not exceed {MaxAllergiesLength} characters in total.");
        RuleForEach(x => x.Allergies)
            .Must(item => !string.IsNullOrWhiteSpace(item) && !item.Contains(','))
            .WithMessage("Each allergy must be non-blank and must not contain a comma.");

        RuleFor(x => x.FibreGrams)
            .InclusiveBetween(0m, 150m)
            .When(x => x.FibreGrams.HasValue);
    }

    private static bool IsValidItem(string? item) =>
        !string.IsNullOrWhiteSpace(item) && item.Trim().Length <= MaxItemLength;
}
