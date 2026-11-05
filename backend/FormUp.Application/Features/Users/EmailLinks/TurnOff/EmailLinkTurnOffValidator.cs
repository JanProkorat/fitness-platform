using FastEndpoints;
using FluentValidation;
using FormUp.Application.Domain.Constants;
using FormUp.Application.Features.Users.EmailLinks.Shared;

namespace FormUp.Application.Features.Users.EmailLinks.TurnOff;

/// <summary>
/// Validates the <see cref="EmailLinkTurnOffRequest"/>.
/// </summary>
internal sealed class EmailLinkTurnOffValidator : Validator<EmailLinkTurnOffRequest>
{
    /// <summary>
    /// Initializes validation rules for turning off a notification email.
    /// </summary>
    public EmailLinkTurnOffValidator()
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
