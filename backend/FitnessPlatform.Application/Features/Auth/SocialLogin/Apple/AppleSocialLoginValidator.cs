using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Auth.SocialLogin.Apple;

/// <summary>
/// Validates the Apple Social Login request.
/// </summary>
public class AppleSocialLoginValidator : Validator<AppleSocialLoginRequest>
{
    /// <summary>
    /// Initializes a new instance of <see cref="AppleSocialLoginValidator"/>.
    /// </summary>
    public AppleSocialLoginValidator()
    {
        RuleFor(x => x.IdentityToken).NotEmpty();
    }
}
