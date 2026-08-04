using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.NutritionPlanTemplates.Shared;
using FluentValidation;

namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.UpdateTemplate;

/// <summary>
/// Validates <see cref="UpdateTemplateRequest"/>, including all nested weeks, days, meals,
/// foods, recipes, and supplements. Mirrors <c>UpdatePlanValidator</c>'s structure — same
/// content tree, same duplicate-<c>MealId</c>-per-day hazard.
/// </summary>
public class UpdateTemplateValidator : Validator<UpdateTemplateRequest>
{
    /// <summary>
    /// Initializes validation rules for a full-state nutrition plan template update.
    /// </summary>
    public UpdateTemplateValidator()
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

        RuleFor(x => x.DietaryStyle)
            .IsInEnum().WithErrorCode(ErrorCodes.OutOfRange)
            .When(x => x.DietaryStyle.HasValue);

        RuleForEach(x => x.Supplements).ChildRules(supplement =>
        {
            supplement.RuleFor(s => s.Name)
                .NotEmpty().WithErrorCode(ErrorCodes.Required)
                .MaximumLength(100).WithErrorCode(ErrorCodes.OutOfRange);

            supplement.RuleFor(s => s.Dose)
                .MaximumLength(200).WithErrorCode(ErrorCodes.OutOfRange)
                .When(s => s.Dose is not null);

            supplement.RuleFor(s => s.Notes)
                .MaximumLength(500).WithErrorCode(ErrorCodes.OutOfRange)
                .When(s => s.Notes is not null);
        });

        RuleFor(x => x.Weeks)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .Must(weeks => weeks.Count <= 52).WithErrorCode(ErrorCodes.OutOfRange)
            .Must(weeks => weeks.Select(w => w.WeekNumber).Distinct().Count() == weeks.Count)
                .WithErrorCode(ErrorCodes.OutOfRange);

        RuleForEach(x => x.Weeks).ChildRules(TemplateWeekRuleSet.Configure);
    }
}
