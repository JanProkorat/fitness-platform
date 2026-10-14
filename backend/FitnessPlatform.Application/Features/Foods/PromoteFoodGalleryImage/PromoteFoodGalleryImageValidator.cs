using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.Foods.PromoteFoodGalleryImage;

/// <summary>
/// Validates the <see cref="PromoteFoodGalleryImageRequest"/>.
/// </summary>
public class PromoteFoodGalleryImageValidator : Validator<PromoteFoodGalleryImageRequest>
{
    /// <summary>
    /// Initializes validation rules for promoting a gallery image.
    /// </summary>
    public PromoteFoodGalleryImageValidator()
    {
        RuleFor(x => x.ImageUrl)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .MaximumLength(2048).WithErrorCode(ErrorCodes.OutOfRange);
    }
}
