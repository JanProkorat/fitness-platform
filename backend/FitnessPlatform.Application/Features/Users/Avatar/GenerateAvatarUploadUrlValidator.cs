using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.Users.Avatar;

/// <summary>
/// Validates the <see cref="GenerateAvatarUploadUrlRequest"/>.
/// Content-type and size enforcement is delegated to <c>IImageUploadService</c>;
/// this validator only asserts presence.
/// </summary>
public class GenerateAvatarUploadUrlValidator : Validator<GenerateAvatarUploadUrlRequest>
{
    /// <summary>
    /// Initializes validation rules for the avatar upload-URL request.
    /// </summary>
    public GenerateAvatarUploadUrlValidator()
    {
        RuleFor(x => x.ContentType)
            .NotEmpty().WithErrorCode(ErrorCodes.Required);

        RuleFor(x => x.SizeBytes)
            .GreaterThan(0).WithErrorCode(ErrorCodes.OutOfRange);
    }
}
