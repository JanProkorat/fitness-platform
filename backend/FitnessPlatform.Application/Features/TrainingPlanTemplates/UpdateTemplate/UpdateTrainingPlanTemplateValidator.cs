using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.TrainingPlanTemplates.Shared;
using FluentValidation;

namespace FitnessPlatform.Application.Features.TrainingPlanTemplates.UpdateTemplate;

/// <summary>
/// Validates <see cref="UpdateTrainingPlanTemplateRequest"/>, including all nested weeks, days, sessions,
/// workouts, and exercises. Mirrors <c>UpdateTrainingPlanValidator</c>'s structure — same content
/// tree, same duplicate-order-per-session hazard.
/// </summary>
public class UpdateTrainingPlanTemplateValidator : Validator<UpdateTrainingPlanTemplateRequest>
{
    /// <summary>
    /// Initializes validation rules for a full-state training plan template update.
    /// </summary>
    public UpdateTrainingPlanTemplateValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .MaximumLength(200).WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.Description)
            .MaximumLength(2000).WithErrorCode(ErrorCodes.OutOfRange)
            .When(x => x.Description is not null);

        RuleFor(x => x.Version)
            .GreaterThanOrEqualTo(1).WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.Goal)
            .IsInEnum().WithErrorCode(ErrorCodes.OutOfRange)
            .When(x => x.Goal.HasValue);

        RuleFor(x => x.Difficulty)
            .IsInEnum().WithErrorCode(ErrorCodes.OutOfRange)
            .When(x => x.Difficulty.HasValue);

        RuleFor(x => x.Weeks)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .Must(weeks => weeks.Count <= 52).WithErrorCode(ErrorCodes.OutOfRange)
            .Must(weeks => weeks.Select(w => w.WeekNumber).Distinct().Count() == weeks.Count)
                .WithErrorCode(ErrorCodes.OutOfRange);

        RuleForEach(x => x.Weeks).ChildRules(TemplateWeekRuleSet.Configure);
    }
}
