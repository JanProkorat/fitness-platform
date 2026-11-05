using FastEndpoints;
using FluentValidation;
using FormUp.Application.Domain.Constants;

namespace FormUp.Application.Features.Recipes.PromoteRecipeGalleryImage;

/// <summary>
/// Validates the <see cref="PromoteRecipeGalleryImageRequest"/>.
/// </summary>
public class PromoteRecipeGalleryImageValidator : Validator<PromoteRecipeGalleryImageRequest>
{
    /// <summary>
    /// Initializes validation rules for promoting a gallery image.
    /// </summary>
    public PromoteRecipeGalleryImageValidator()
    {
        RuleFor(x => x.ImageUrl)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .MaximumLength(2048).WithErrorCode(ErrorCodes.OutOfRange);
    }
}
