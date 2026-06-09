using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.Trainers.ClientNotes.DeleteNote;

public class DeleteNoteValidator : Validator<DeleteNoteRequest>
{
    public DeleteNoteValidator()
    {
        RuleFor(x => x.ClientId)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.Required);

        RuleFor(x => x.NoteId)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.Required);
    }
}
