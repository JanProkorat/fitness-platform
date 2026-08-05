using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FluentValidation;

namespace FitnessPlatform.Application.Features.SessionTemplates.SaveSessionTemplateFromPlan;

/// <summary>
/// Validates the <see cref="SaveSessionTemplateFromPlanRequest"/>. Shape-only — whether the
/// referenced plan/session actually exists and is owned by the caller is domain state, checked
/// in the endpoint via a 404 (rules/validation.md#what-goes-where).
/// </summary>
internal sealed class SaveSessionTemplateFromPlanValidator : Validator<SaveSessionTemplateFromPlanRequest>
{
    /// <summary>
    /// Initializes validation rules for saving a template from a plan session.
    /// </summary>
    public SaveSessionTemplateFromPlanValidator()
    {
        RuleFor(x => x.PlanId)
            .NotEmpty().WithErrorCode(ErrorCodes.Required);

        RuleFor(x => x.WeekNumber)
            .GreaterThan(0).WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.DayOfWeek)
            .InclusiveBetween(1, 7).WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.SessionId)
            .NotEmpty().WithErrorCode(ErrorCodes.Required);

        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .MaximumLength(200).WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.Description)
            .MaximumLength(2000).WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.Visibility)
            .IsInEnum().WithErrorCode(ErrorCodes.OutOfRange);
    }
}
