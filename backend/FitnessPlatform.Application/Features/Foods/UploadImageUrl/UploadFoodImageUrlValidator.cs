using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.Foods.UploadImageUrl;

/// <summary>
/// Validates the <see cref="UploadFoodImageUrlRequest"/>.
/// Content-type and size enforcement is delegated to <c>IImageUploadService</c>;
/// this validator asserts presence and slot validity.
/// </summary>
public class UploadFoodImageUrlValidator : Validator<UploadFoodImageUrlRequest>
{
    private static readonly HashSet<string> ValidSlots =
        new(StringComparer.OrdinalIgnoreCase) { "main", "gallery" };

    /// <summary>
    /// Initializes validation rules for the food image upload-URL request.
    /// </summary>
    public UploadFoodImageUrlValidator()
    {
        RuleFor(x => x.ContentType)
            .NotEmpty().WithErrorCode(ErrorCodes.Required);

        RuleFor(x => x.SizeBytes)
            .GreaterThan(0).WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.Slot)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .Must(s => ValidSlots.Contains(s))
            .WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage("Slot must be 'main' or 'gallery'.");
    }
}
