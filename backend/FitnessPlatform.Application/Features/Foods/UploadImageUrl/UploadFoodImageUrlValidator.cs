using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.Foods.UploadImageUrl;

/// <summary>
/// Validates the <see cref="UploadFoodImageUrlRequest"/>.
/// Content-type and size enforcement is delegated to <c>IImageUploadService</c>;
/// this validator only asserts presence.
/// </summary>
public class UploadFoodImageUrlValidator : Validator<UploadFoodImageUrlRequest>
{
    /// <summary>
    /// Initializes validation rules for the food image upload-URL request.
    /// </summary>
    public UploadFoodImageUrlValidator()
    {
        RuleFor(x => x.ContentType)
            .NotEmpty().WithErrorCode(ErrorCodes.Required);

        RuleFor(x => x.SizeBytes)
            .GreaterThan(0).WithErrorCode(ErrorCodes.OutOfRange);
    }
}
