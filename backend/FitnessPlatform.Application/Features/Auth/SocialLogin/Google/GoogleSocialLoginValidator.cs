using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Auth.SocialLogin.Google;

/// <summary>
/// Validates the request body for <c>POST /auth/social/google</c>.
/// </summary>
public class GoogleSocialLoginValidator : Validator<GoogleSocialLoginRequest>
{
    /// <summary>
    /// Initializes the validation rules.
    /// </summary>
    public GoogleSocialLoginValidator()
    {
        RuleFor(x => x.IdToken)
            .NotEmpty()
            .WithMessage("Google ID token is required.");
    }
}
