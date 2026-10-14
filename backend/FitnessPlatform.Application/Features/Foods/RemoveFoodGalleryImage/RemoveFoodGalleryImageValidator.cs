using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.Foods.RemoveFoodGalleryImage;

/// <summary>
/// Validates the <see cref="RemoveFoodGalleryImageRequest"/>.
/// </summary>
public class RemoveFoodGalleryImageValidator : Validator<RemoveFoodGalleryImageRequest>
{
    /// <summary>
    /// Initializes validation rules for removing a gallery image.
    /// </summary>
    public RemoveFoodGalleryImageValidator()
    {
        RuleFor(x => x.ImageUrl)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .MaximumLength(2048).WithErrorCode(ErrorCodes.OutOfRange);
    }
}
