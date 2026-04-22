using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.Recipes.ConfirmRecipeImage;

/// <summary>
/// Validates the <see cref="ConfirmRecipeImageRequest"/>.
/// </summary>
public class ConfirmRecipeImageValidator : Validator<ConfirmRecipeImageRequest>
{
    private static readonly HashSet<string> ValidSlots =
        new(StringComparer.OrdinalIgnoreCase) { "main", "gallery" };

    /// <summary>
    /// Initializes validation rules for the recipe image confirmation request.
    /// </summary>
    public ConfirmRecipeImageValidator()
    {
        RuleFor(x => x.BlobUrl)
            .NotEmpty().WithErrorCode(ErrorCodes.Required);

        RuleFor(x => x.Slot)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .Must(s => ValidSlots.Contains(s))
            .WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage("Slot must be 'main' or 'gallery'.");
    }
}
