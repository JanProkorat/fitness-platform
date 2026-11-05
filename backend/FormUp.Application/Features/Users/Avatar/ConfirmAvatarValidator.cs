using FastEndpoints;
using FluentValidation;
using FormUp.Application.Domain.Constants;

namespace FormUp.Application.Features.Users.Avatar;

/// <summary>
/// Validates the <see cref="ConfirmAvatarRequest"/>.
/// </summary>
public class ConfirmAvatarValidator : Validator<ConfirmAvatarRequest>
{
    /// <summary>
    /// Initializes validation rules for the avatar confirmation request.
    /// </summary>
    public ConfirmAvatarValidator()
    {
        RuleFor(x => x.BlobUrl)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .MaximumLength(500).WithErrorCode(ErrorCodes.OutOfRange);
    }
}
