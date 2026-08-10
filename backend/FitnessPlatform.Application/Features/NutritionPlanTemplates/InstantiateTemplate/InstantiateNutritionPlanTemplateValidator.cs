using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FluentValidation;

namespace FitnessPlatform.Application.Features.NutritionPlanTemplates.InstantiateTemplate;

/// <summary>
/// Validates the <see cref="InstantiateNutritionPlanTemplateRequest"/>. Mirrors <c>CreatePlanValidator</c>'s
/// start-date rules — <c>instantiate</c> replicates plan-creation's date invariants rather than
/// bypassing them.
/// </summary>
public class InstantiateNutritionPlanTemplateValidator : Validator<InstantiateNutritionPlanTemplateRequest>
{
    /// <summary>
    /// Initializes validation rules for instantiating a template.
    /// </summary>
    public InstantiateNutritionPlanTemplateValidator()
    {
        RuleFor(x => x.ClientId)
            .NotEmpty().WithErrorCode(ErrorCodes.Required);

        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .MaximumLength(200).WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.StartDate)
            .Must(d => d!.Value.DayOfWeek == System.DayOfWeek.Monday)
            .WithErrorCode(ErrorCodes.StartDateNotMonday)
            .WithMessage("Start date must be a Monday.")
            .When(x => x.StartDate.HasValue);

        RuleFor(x => x.StartDate)
            .Must(d => DateOnly.FromDateTime(d!.Value) >= DateOnly.FromDateTime(DateTime.UtcNow))
            .WithErrorCode(ErrorCodes.StartDateInPast)
            .WithMessage("Start date cannot be in the past.")
            .When(x => x.StartDate.HasValue);
    }
}
