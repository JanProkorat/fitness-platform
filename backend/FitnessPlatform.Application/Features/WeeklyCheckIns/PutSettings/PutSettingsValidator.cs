using FastEndpoints;
using FluentValidation;
using FitnessPlatform.Application.Domain.Constants;

namespace FitnessPlatform.Application.Features.WeeklyCheckIns.PutSettings;

/// <summary>
/// Validates <see cref="PutSettingsRequest"/>.
/// </summary>
public class PutSettingsValidator : Validator<PutSettingsRequest>
{
    /// <summary>
    /// Initializes validation rules.
    /// </summary>
    public PutSettingsValidator()
    {
        RuleFor(x => x.Profession)
            .NotEmpty()
            .Must(p => p == "Training" || p == "Nutrition")
            .WithMessage("Profession must be 'Training' or 'Nutrition'.");

        RuleFor(x => x.DayOfWeek)
            .InclusiveBetween(0, 6)
            .WithMessage("DayOfWeek must be between 0 (Sunday) and 6 (Saturday).");

        RuleFor(x => x.TimeOfDay)
            .Must(t => t.Minutes == 0 && t.Seconds == 0 && t.Milliseconds == 0)
            .WithErrorCode(ErrorCodes.InvalidTimeOfDay)
            .WithMessage("TimeOfDay must be hour-aligned (minutes, seconds, and milliseconds must be zero).");

        RuleFor(x => x.DefaultAddendum)
            .MaximumLength(200)
            .When(x => x.DefaultAddendum is not null);
    }
}
