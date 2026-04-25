using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.ClientNutrition.GenerateDayPhotoUploadUrl;

/// <summary>
/// Validates the <see cref="GenerateDayPhotoUploadUrlRequest"/>.
/// Whitelists image content types and enforces a 10 MiB size cap —
/// mirrors <c>GenerateMealPhotoUploadUrlValidator</c> exactly.
/// </summary>
public class GenerateDayPhotoUploadUrlValidator : Validator<GenerateDayPhotoUploadUrlRequest>
{
    private static readonly string[] AllowedContentTypes =
    [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
    ];

    /// <summary>Maximum allowed image file size: 10 MiB.</summary>
    public const long MaxSizeBytes = 10L * 1024 * 1024;

    /// <summary>
    /// Initializes validation rules for the day photo upload-URL request.
    /// </summary>
    public GenerateDayPhotoUploadUrlValidator()
    {
        RuleFor(x => x.ContentType)
            .NotEmpty().WithErrorCode(ErrorCodes.Required);

        RuleFor(x => x.ContentType)
            .Must(ct => AllowedContentTypes.Contains(ct, StringComparer.OrdinalIgnoreCase))
            .WithErrorCode(ErrorCodes.InvalidImageContentType)
            .WithMessage($"Content type must be one of: {string.Join(", ", AllowedContentTypes)}.")
            .When(x => !string.IsNullOrEmpty(x.ContentType));

        RuleFor(x => x.SizeBytes)
            .GreaterThan(0).WithErrorCode(ErrorCodes.OutOfRange)
            .LessThanOrEqualTo(MaxSizeBytes)
            .WithErrorCode(ErrorCodes.ImageTooLarge)
            .WithMessage($"Image must not exceed {MaxSizeBytes / (1024 * 1024)} MB.");
    }
}
