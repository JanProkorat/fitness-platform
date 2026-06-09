using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.Trainers.ClientNotes.ListNotes;

public class ListNotesValidator : Validator<ListNotesRequest>
{
    public ListNotesValidator()
    {
        RuleFor(x => x.ClientId)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.Required);

        RuleFor(x => x.Page)
            .GreaterThanOrEqualTo(1)
            .WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.PageSize)
            .InclusiveBetween(1, 100)
            .WithErrorCode(ErrorCodes.OutOfRange);
    }
}
