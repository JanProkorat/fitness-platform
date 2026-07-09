using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Auth.AnonymousResendVerification;

/// <summary>
/// Validates the <see cref="AnonymousResendVerificationRequest"/>.
/// </summary>
public class AnonymousResendVerificationValidator : Validator<AnonymousResendVerificationRequest>
{
    /// <summary>
    /// Initializes validation rules for the anonymous resend-verification request.
    /// </summary>
    public AnonymousResendVerificationValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress()
            .MaximumLength(256);
    }
}
