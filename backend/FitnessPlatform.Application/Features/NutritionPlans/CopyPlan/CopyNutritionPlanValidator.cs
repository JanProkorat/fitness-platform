using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FluentValidation;

namespace FitnessPlatform.Application.Features.NutritionPlans.CopyPlan;

/// <summary>
/// Validates the <see cref="CopyNutritionPlanRequest"/>. Mirrors the start-date rules of plan
/// creation so a copy cannot bypass them.
/// </summary>
public class CopyNutritionPlanValidator : Validator<CopyNutritionPlanRequest>
{
    /// <summary>
    /// Initializes validation rules for copying a nutrition plan.
    /// </summary>
    public CopyNutritionPlanValidator()
    {
        RuleFor(x => x.ClientId)
            .NotEmpty().WithErrorCode(ErrorCodes.Required);

        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .MaximumLength(200).WithErrorCode(ErrorCodes.OutOfRange)
            .When(x => x.Name is not null);

        RuleFor(x => x.StartDate)
            .Must(d => d!.Value.DayOfWeek == DayOfWeek.Monday)
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
