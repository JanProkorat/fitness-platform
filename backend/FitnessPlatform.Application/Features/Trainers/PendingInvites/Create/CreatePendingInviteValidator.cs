using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Trainers.PendingInvites.Create;

/// <summary>
/// Validates the <see cref="CreatePendingInviteRequest"/>.
/// </summary>
public class CreatePendingInviteValidator : Validator<CreatePendingInviteRequest>
{
    /// <summary>
    /// Initializes validation rules for creating a pending invitation.
    /// </summary>
    public CreatePendingInviteValidator()
    {
        RuleFor(x => x.FirstName)
            .NotEmpty()
            .MaximumLength(100);

        RuleFor(x => x.LastName)
            .NotEmpty()
            .MaximumLength(100);

        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress()
            .MaximumLength(100);
    }
}
