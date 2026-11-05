using FastEndpoints;
using FluentValidation;
using FormUp.Application.Features.Auth.Shared;

namespace FormUp.Application.Features.Auth.SocialLogin.Apple;

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
        RuleFor(x => x.Nonce).NotEmpty();

        RuleForEach(x => x.Roles)
            .Must(SocialSignUpRoles.IsAllowed)
            .WithMessage(SocialSignUpRoles.InvalidRoleMessage);

        RuleFor(x => x.Roles)
            .Must(roles => !SocialSignUpRoles.MixesClientWithCoach(roles))
            .WithMessage(SocialSignUpRoles.ClientCoachMixMessage);

        // "Client must consent" is enforced by the endpoint for new accounts only: an empty role
        // list means Client, and linked users sign in without the field.
        RuleFor(x => x.HealthDataConsent)
            .Null()
            .WithMessage(SocialSignUpRoles.CoachHealthDataConsentMessage)
            .When(x => x.Roles is not null && SocialSignUpRoles.HasCoachRole(x.Roles));
    }
}
