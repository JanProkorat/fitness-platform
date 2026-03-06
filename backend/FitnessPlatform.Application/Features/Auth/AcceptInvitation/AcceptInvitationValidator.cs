using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Auth.AcceptInvitation;

/// <summary>
/// Validates the <see cref="AcceptInvitationRequest"/>.
/// </summary>
public class AcceptInvitationValidator : Validator<AcceptInvitationRequest>
{
    /// <summary>
    /// Initializes validation rules for accepting an invitation.
    /// </summary>
    public AcceptInvitationValidator()
    {
        RuleFor(x => x.Token)
            .NotEmpty();
    }
}
