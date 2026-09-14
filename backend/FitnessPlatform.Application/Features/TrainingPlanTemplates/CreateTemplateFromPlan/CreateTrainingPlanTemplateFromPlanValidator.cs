using FastEndpoints;
using FitnessPlatform.Application.Domain.Constants;
using FluentValidation;

namespace FitnessPlatform.Application.Features.TrainingPlanTemplates.CreateTemplateFromPlan;

/// <summary>
/// Validates the <see cref="CreateTrainingPlanTemplateFromPlanRequest"/>.
/// </summary>
public class CreateTrainingPlanTemplateFromPlanValidator : Validator<CreateTrainingPlanTemplateFromPlanRequest>
{
    /// <summary>
    /// Initializes validation rules for saving a plan as a template.
    /// </summary>
    public CreateTrainingPlanTemplateFromPlanValidator()
    {
        RuleFor(x => x.PlanId)
            .NotEmpty().WithErrorCode(ErrorCodes.Required);

        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required)
            .MaximumLength(200).WithErrorCode(ErrorCodes.OutOfRange);

        RuleFor(x => x.Description)
            .MaximumLength(2000).WithErrorCode(ErrorCodes.OutOfRange)
            .When(x => x.Description is not null);
    }
}
