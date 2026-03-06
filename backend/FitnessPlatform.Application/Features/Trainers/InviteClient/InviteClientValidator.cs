using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Trainers.InviteClient;

/// <summary>
/// Validates the <see cref="InviteClientRequest"/>.
/// </summary>
public class InviteClientValidator : Validator<InviteClientRequest>
{
    /// <summary>
    /// Initializes validation rules for client invitation.
    /// </summary>
    public InviteClientValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress()
            .MaximumLength(100);
    }
}
