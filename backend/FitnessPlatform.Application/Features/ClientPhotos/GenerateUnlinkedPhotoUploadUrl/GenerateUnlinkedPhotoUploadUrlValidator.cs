using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.ClientPhotos.GenerateUnlinkedPhotoUploadUrl;

/// <summary>
/// Validator for <see cref="GenerateUnlinkedPhotoUploadUrlRequest"/>.
/// </summary>
public class GenerateUnlinkedPhotoUploadUrlValidator : Validator<GenerateUnlinkedPhotoUploadUrlRequest>
{
    /// <summary>
    /// Initializes a new instance of <see cref="GenerateUnlinkedPhotoUploadUrlValidator"/>.
    /// </summary>
    public GenerateUnlinkedPhotoUploadUrlValidator()
    {
        RuleFor(x => x.ContentType)
            .NotEmpty()
            .Must(contentType => contentType is "image/jpeg" or "image/png" or "image/webp" or "image/heic" or "image/heif")
            .WithMessage("Content type must be one of: image/jpeg, image/png, image/webp, image/heic, image/heif.");

        RuleFor(x => x.SizeBytes)
            .GreaterThan(0)
            .LessThanOrEqualTo(5L * 1024 * 1024)
            .WithMessage("File size must be between 1 byte and 5 MiB.");
    }
}
