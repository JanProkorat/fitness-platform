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
        RuleFor(x => x.Token)
            .NotEmpty()
            .MaximumLength(256)
            .WithErrorCode(ErrorCodes.EmailLinkInvalid)
            .WithMessage(EmailLinkPreferenceSwitch.InvalidMessage);
    }
}
