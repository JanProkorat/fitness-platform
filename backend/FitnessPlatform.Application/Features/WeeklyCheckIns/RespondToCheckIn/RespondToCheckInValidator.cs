using FastEndpoints;
using FluentValidation;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.RespondToCheckIn;

/// <summary>
/// Validates <see cref="RespondToCheckInRequest"/>.
/// </summary>
public class RespondToCheckInValidator : Validator<RespondToCheckInRequest>
{
    /// <summary>Initializes validation rules.</summary>
    public RespondToCheckInValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty()
            .WithMessage("Check-in id is required.");

        RuleFor(x => x.Note)
            .MaximumLength(500)
            .When(x => x.Note is not null)
            .WithMessage("Note must not exceed 500 characters.");

        RuleFor(x => x.HungerScore)
            .InclusiveBetween(1, 5)
            .When(x => x.HungerScore.HasValue)
            .WithMessage("Hunger score must be between 1 and 5.");
    }
}
