using System.ComponentModel.DataAnnotations;
using System.Reflection;
using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Entities;

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
    /// The maximum length of <see cref="BroadcastMessageRequest.Text"/> before per-recipient
    /// {{firstName}}/{{fullName}} substitution. Read reflectively off <see cref="ChatMessage.Text"/>'s
    /// own <see cref="MaxLengthAttribute"/> rather than duplicated as a literal, so a future change
    /// to the column's storage limit widens this cap automatically instead of silently reopening
    /// the pre-fix overflow bug (a template at the old cap passing validation, then overflowing the
    /// column once substitution grows it). Substitution can only grow the text, so the endpoint
    /// re-checks this same limit against each recipient's *substituted* text before sending
    /// anything — see <c>BroadcastMessageEndpoint.HandleAsync</c>.
    /// </summary>
    public static readonly int MaxTextLength = typeof(ChatMessage)
        .GetProperty(nameof(ChatMessage.Text))!
        .GetCustomAttribute<MaxLengthAttribute>()!
        .Length;

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
            .MaximumLength(MaxTextLength)
            .WithMessage($"Message must be at most {MaxTextLength} characters.");
    }
}
