using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.Trainers.ClientNotes.EditNote;

public class EditNoteValidator : Validator<EditNoteRequest>
{
    public EditNoteValidator()
    {
        RuleFor(x => x.ClientId)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.Required);

        RuleFor(x => x.NoteId)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.Required);

        RuleFor(x => x.Text)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.Required)
            .MaximumLength(2000)
            .WithErrorCode(ErrorCodes.OutOfRange);
    }
}
