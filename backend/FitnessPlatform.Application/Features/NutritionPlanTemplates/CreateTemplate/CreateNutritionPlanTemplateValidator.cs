using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Features.NutritionPlanTemplates.Shared;
using FluentValidation;

namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.CreateTemplate;

/// <summary>
/// Validates the <see cref="CreateNutritionPlanTemplateRequest"/>.
/// </summary>
public class CreateNutritionPlanTemplateValidator : Validator<CreateNutritionPlanTemplateRequest>
{
    /// <summary>
    /// Initializes validation rules for creating a nutrition plan template.
    /// </summary>
    public CreateNutritionPlanTemplateValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .MaximumLength(200).WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.Description)
            .MaximumLength(2000).WithErrorCode(ErrorCodes.OutOfRange)
            .When(x => x.Description is not null);

        RuleFor(x => x)
            .Must(x => x.WeekCount.HasValue || x.Weeks is { Count: > 0 })
            .WithErrorCode(ErrorCodes.Required)
            .WithMessage("Provide either weekCount or weeks.");

        RuleFor(x => x)
            .Must(x => !(x.WeekCount.HasValue && x.Weeks is { Count: > 0 }))
            .WithErrorCode(ErrorCodes.OutOfRange)
            .WithMessage("weekCount and weeks are mutually exclusive.");

        RuleFor(x => x.WeekCount)
            .InclusiveBetween(1, 52).WithErrorCode(ErrorCodes.OutOfRange)
            .When(x => x.WeekCount.HasValue);

        RuleFor(x => x.Weeks)
            .Must(weeks => weeks!.Count <= 52).WithErrorCode(ErrorCodes.OutOfRange)
                .WithMessage("A template may not exceed 52 weeks.")
            .Must(weeks => weeks!.Select(w => w.WeekNumber).Distinct().Count() == weeks!.Count)
                .WithErrorCode(ErrorCodes.OutOfRange)
            .When(x => x.Weeks is { Count: > 0 });

        RuleForEach(x => x.Weeks!)
            .ChildRules(TemplateWeekRuleSet.Configure)
            .When(x => x.Weeks is { Count: > 0 });

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
    }
}
