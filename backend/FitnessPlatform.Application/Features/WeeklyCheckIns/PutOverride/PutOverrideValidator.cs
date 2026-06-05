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
            .Must(t => t!.Value >= TimeSpan.Zero && t.Value < TimeSpan.FromHours(24))
            .When(x => x.TimeOfDay.HasValue)
            .WithErrorCode(ErrorCodes.InvalidTimeOfDay)
            .WithMessage("TimeOfDay must be between 00:00:00 and 23:59:59.");

        RuleFor(x => x.Addendum)
            .MaximumLength(200)
            .When(x => x.Addendum is not null);

        RuleFor(x => x.DeadlineOffsetHours)
            .Must(h => h == 24 || h == 48 || h == 72 || h == 120 || h == 168)
            .When(x => x.DeadlineOffsetHours.HasValue)
            .WithErrorCode(ErrorCodes.InvalidDeadlineOffsetHours)
            .WithMessage("DeadlineOffsetHours must be one of: 24, 48, 72, 120, 168.");
    }
}
