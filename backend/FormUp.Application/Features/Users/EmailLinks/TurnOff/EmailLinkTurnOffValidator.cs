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
        RuleFor(x => x.Token)
            .NotEmpty()
            .MaximumLength(256)
            .WithErrorCode(ErrorCodes.EmailLinkInvalid)
            .WithMessage(EmailLinkPreferenceSwitch.InvalidMessage);
    }
}
