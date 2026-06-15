using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.Trainers.ClientNotes.CreateNote;

public class CreateNoteValidator : Validator<CreateNoteRequest>
{
    public CreateNoteValidator()
    {
        RuleFor(x => x.ClientId)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.Required);

        RuleFor(x => x.Text)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.Required)
            .MaximumLength(2000)
            .WithErrorCode(ErrorCodes.OutOfRange);
    }
}
