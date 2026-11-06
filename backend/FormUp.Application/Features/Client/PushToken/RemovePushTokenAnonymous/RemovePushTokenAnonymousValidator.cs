using FastEndpoints;
using FluentValidation;

namespace FormUp.Application.Features.Client.PushToken.RemovePushTokenAnonymous;

/// <summary>
/// Validates the <see cref="RemovePushTokenAnonymousRequest"/>.
/// </summary>
internal sealed class RemovePushTokenAnonymousValidator : Validator<RemovePushTokenAnonymousRequest>
{
    /// <summary>
    /// Initializes validation rules for removing a push token.
    /// </summary>
    public RemovePushTokenAnonymousValidator()
    {
        RuleFor(x => x.Token)
            .NotEmpty()
            .MaximumLength(256)
            .Matches(@"^(ExponentPushToken|ExpoPushToken)\[[^\[\]\s]+\]$");
    }
}
