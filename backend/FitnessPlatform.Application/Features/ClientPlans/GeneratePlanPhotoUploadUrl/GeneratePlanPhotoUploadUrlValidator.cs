using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientPlans.GeneratePlanPhotoUploadUrl;

/// <summary>
/// Validator for <see cref="GeneratePlanPhotoUploadUrlRequest"/>.
/// </summary>
public class GeneratePlanPhotoUploadUrlValidator : Validator<GeneratePlanPhotoUploadUrlRequest>
{
    /// <summary>
    /// Initializes a new instance of <see cref="GeneratePlanPhotoUploadUrlValidator"/>.
    /// </summary>
    public GeneratePlanPhotoUploadUrlValidator()
    {
        RuleFor(x => x.ContentType)
            .NotEmpty()
            .Must(ct => ct is "image/jpeg" or "image/png" or "image/webp" or "image/heic" or "image/heif")
            .WithMessage("Content type must be one of: image/jpeg, image/png, image/webp, image/heic, image/heif.");

        RuleFor(x => x.SizeBytes)
            .GreaterThan(0)
            .LessThanOrEqualTo(5L * 1024 * 1024)
            .WithMessage("File size must be between 1 byte and 5 MiB.");
    }
}
