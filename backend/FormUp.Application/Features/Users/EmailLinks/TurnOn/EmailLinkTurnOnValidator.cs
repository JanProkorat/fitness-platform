using FastEndpoints;
using FluentValidation;
using FormUp.Application.Domain.Constants;
using FormUp.Application.Features.Users.EmailLinks.Shared;

namespace FormUp.Application.Features.Users.EmailLinks.TurnOn;

/// <summary>
/// Validates the <see cref="EmailLinkTurnOnRequest"/>.
/// </summary>
internal sealed class EmailLinkTurnOnValidator : Validator<EmailLinkTurnOnRequest>
{
    /// <summary>
    /// Initializes validation rules for turning a notification email back on.
    /// </summary>
    public EmailLinkTurnOnValidator()
    {
        // Each rule carries the code: WithErrorCode only applies to the rule just before it.
        RuleFor(x => x.Token)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.EmailLinkInvalid)
            .WithMessage(EmailLinkPreferenceSwitch.InvalidMessage)
            .MaximumLength(256)
            .WithErrorCode(ErrorCodes.EmailLinkInvalid)
            .WithMessage(EmailLinkPreferenceSwitch.InvalidMessage);
    }
}
