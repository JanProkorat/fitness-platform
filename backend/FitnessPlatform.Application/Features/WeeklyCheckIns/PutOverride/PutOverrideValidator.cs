using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.PutOverride;

/// <summary>
/// Validates <see cref="PutOverrideRequest"/>.
/// </summary>
public class PutOverrideValidator : Validator<PutOverrideRequest>
{
    /// <summary>
    /// Initializes validation rules.
    /// </summary>
    public PutOverrideValidator()
    {
        RuleFor(x => x.ClientUserId)
            .NotEmpty();

        RuleFor(x => x.Profession)
            .NotEmpty()
            .Must(p => p == "Training" || p == "Nutrition")
            .WithMessage("Profession must be 'Training' or 'Nutrition'.");

        RuleFor(x => x.DayOfWeek)
            .InclusiveBetween(0, 6)
            .When(x => x.DayOfWeek.HasValue)
            .WithMessage("DayOfWeek must be between 0 (Sunday) and 6 (Saturday).");

        RuleFor(x => x.TimeOfDay)
            .Must(t => t!.Value.Minutes == 0 && t.Value.Seconds == 0 && t.Value.Milliseconds == 0)
            .When(x => x.TimeOfDay.HasValue)
            .WithErrorCode(ErrorCodes.InvalidTimeOfDay)
            .WithMessage("TimeOfDay must be hour-aligned (minutes, seconds, and milliseconds must be zero).");

        RuleFor(x => x.Addendum)
            .MaximumLength(200)
            .When(x => x.Addendum is not null);
    }
}
