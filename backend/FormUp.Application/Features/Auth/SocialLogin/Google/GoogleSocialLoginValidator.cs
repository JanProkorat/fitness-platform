using FastEndpoints;
using FluentValidation;
using FormUp.Application.Features.Auth.Shared;

namespace FormUp.Application.Features.Auth.SocialLogin.Google;

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

        RuleFor(x => x.Nonce).NotEmpty();

        RuleForEach(x => x.Roles)
            .Must(SocialSignUpRoles.IsAllowed)
            .WithMessage(SocialSignUpRoles.InvalidRoleMessage);

        RuleFor(x => x.Roles)
            .Must(roles => !SocialSignUpRoles.MixesClientWithCoach(roles))
            .WithMessage(SocialSignUpRoles.ClientCoachMixMessage);
    }
}
