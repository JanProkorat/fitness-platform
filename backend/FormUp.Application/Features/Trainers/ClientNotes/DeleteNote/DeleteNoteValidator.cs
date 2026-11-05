using FastEndpoints;
using FluentValidation;
using FormUp.Application.Domain.Constants;

namespace FormUp.Application.Features.Trainers.ClientNotes.DeleteNote;

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
