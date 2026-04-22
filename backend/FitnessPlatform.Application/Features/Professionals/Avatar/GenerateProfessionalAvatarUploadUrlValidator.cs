using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.Professionals.Avatar;

/// <summary>
/// Validates the <see cref="GenerateProfessionalAvatarUploadUrlRequest"/>.
/// Content-type and size enforcement is delegated to <c>IImageUploadService</c>;
/// this validator only asserts presence.
/// </summary>
public class GenerateProfessionalAvatarUploadUrlValidator : Validator<GenerateProfessionalAvatarUploadUrlRequest>
{
    /// <summary>
    /// Initializes validation rules for the professional avatar upload-URL request.
    /// </summary>
    public GenerateProfessionalAvatarUploadUrlValidator()
    {
        RuleFor(x => x.ContentType)
            .NotEmpty().WithErrorCode(ErrorCodes.Required);

        RuleFor(x => x.SizeBytes)
            .GreaterThan(0).WithErrorCode(ErrorCodes.OutOfRange);
    }
}
