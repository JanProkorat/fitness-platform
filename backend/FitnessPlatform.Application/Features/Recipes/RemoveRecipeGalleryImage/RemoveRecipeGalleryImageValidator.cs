using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.Recipes.RemoveRecipeGalleryImage;

/// <summary>
/// Validates the <see cref="RemoveRecipeGalleryImageRequest"/>.
/// </summary>
public class RemoveRecipeGalleryImageValidator : Validator<RemoveRecipeGalleryImageRequest>
{
    /// <summary>
    /// Initializes validation rules for removing a gallery image.
    /// </summary>
    public RemoveRecipeGalleryImageValidator()
    {
        RuleFor(x => x.ImageUrl)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .MaximumLength(2048).WithErrorCode(ErrorCodes.OutOfRange);
    }
}
