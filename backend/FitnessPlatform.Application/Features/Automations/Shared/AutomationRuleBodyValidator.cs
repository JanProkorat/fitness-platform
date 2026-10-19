using FitnessPlatform.Application.Domain.Constants;
using FitnessPlatform.Application.Domain.Enums;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Automations.Shared;

/// <summary>
/// Shape rules for the identity and action of an automation rule, on top of the trigger rules.
/// </summary>
/// <typeparam name="T">The request type carrying a rule body.</typeparam>
public abstract class AutomationRuleBodyValidator<T> : AutomationTriggerBodyValidator<T>
    where T : AutomationRuleBody
{
    /// <summary>
    /// Initializes the shared name and action rules.
    /// </summary>
    protected AutomationRuleBodyValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);

        RuleFor(x => x.ActionType).IsInEnum();

        RuleFor(x => x.Message)
            .MaximumLength(AutomationTriggerBody.PhotoMessageMaxLength)
            .WithErrorCode(ErrorCodes.AutomationPhotoMessageTooLong)
            .WithMessage("A progress photos message can be at most 500 characters.")
            .When(x => x.ActionType == AutomationActionType.RequestProgressPhotos);

        RuleFor(x => x.QuestionnaireId)
            .NotNull()
            .WithErrorCode(ErrorCodes.AutomationQuestionnaireRequired)
            .WithMessage("A send-form rule needs a questionnaire.")
            .When(x => x.ActionType == AutomationActionType.SendForm);
    }
}
