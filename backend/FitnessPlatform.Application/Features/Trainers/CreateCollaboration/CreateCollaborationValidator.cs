using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Trainers.CreateCollaboration;

/// <summary>
/// Validates the <see cref="CreateCollaborationRequest"/>.
/// </summary>
public class CreateCollaborationValidator : Validator<CreateCollaborationRequest>
{
    /// <summary>
    /// Initializes validation rules for creating a collaboration.
    /// </summary>
    public CreateCollaborationValidator()
    {
        RuleFor(x => x.ClientPublicId)
            .NotEmpty();

        RuleFor(x => x.CollaboratorPublicId)
            .NotEmpty();

        RuleFor(x => x.RequestedScope)
            .IsInEnum().WithErrorCode(ErrorCodes.OutOfRange);
    }
}
