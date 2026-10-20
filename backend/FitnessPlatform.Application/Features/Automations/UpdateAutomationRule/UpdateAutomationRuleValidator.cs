using FitnessPlatform.Application.Features.Automations.Shared;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Automations.UpdateAutomationRule;

/// <summary>
/// Validates the <see cref="UpdateAutomationRuleRequest"/>.
/// </summary>
public class UpdateAutomationRuleValidator : AutomationAudienceBodyValidator<UpdateAutomationRuleRequest>
{
    /// <summary>
    /// Initializes validation rules for updating an automation rule.
    /// </summary>
    public UpdateAutomationRuleValidator()
    {
        RuleFor(x => x.RuleId).NotEmpty();
    }
}
