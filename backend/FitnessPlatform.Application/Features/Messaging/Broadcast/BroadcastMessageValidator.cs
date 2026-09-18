using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.Messaging.Broadcast;

/// <summary>
/// Validates the <see cref="BroadcastMessageRequest"/>.
/// </summary>
public class BroadcastMessageValidator : Validator<BroadcastMessageRequest>
{
    /// <summary>
    /// The maximum number of recipients a single broadcast may target.
    /// </summary>
    public const int MaxRecipients = 50;

    /// <summary>
    /// Initializes validation rules for broadcasting a message.
    /// </summary>
    public BroadcastMessageValidator()
    {
        RuleFor(x => x.ClientPublicIds)
            .NotEmpty()
            .WithMessage("At least one recipient is required.");

        RuleFor(x => x.ClientPublicIds)
            .Must(ids => ids.Count <= MaxRecipients)
            .WithErrorCode(ErrorCodes.BroadcastRecipientLimitExceeded)
            .WithMessage($"A broadcast may target at most {MaxRecipients} recipients.")
            .When(x => x.ClientPublicIds.Count > 0);

        RuleFor(x => x.Text)
            .NotEmpty()
            .WithMessage("Message text is required.")
            .MaximumLength(4000)
            .WithMessage("Message must be at most 4000 characters.");
    }
}
