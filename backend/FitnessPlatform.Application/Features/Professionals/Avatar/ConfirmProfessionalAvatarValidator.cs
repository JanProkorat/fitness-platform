using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.Professionals.Avatar;

/// <summary>
/// Validates the <see cref="ConfirmProfessionalAvatarRequest"/>.
/// </summary>
public class ConfirmProfessionalAvatarValidator : Validator<ConfirmProfessionalAvatarRequest>
{
    /// <summary>
    /// Initializes validation rules for the professional avatar confirmation request.
    /// </summary>
    public ConfirmProfessionalAvatarValidator()
    {
        RuleFor(x => x.BlobUrl)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .MaximumLength(500).WithErrorCode(ErrorCodes.OutOfRange);
    }
}
