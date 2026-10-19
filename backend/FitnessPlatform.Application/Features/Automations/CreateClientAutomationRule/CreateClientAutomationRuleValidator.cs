using FitnessPlatform.Application.Features.Automations.Shared;
using FluentValidation;

namespace FitnessPlatform.Application.Features.Automations.CreateClientAutomationRule;

/// <summary>
/// Validates the <see cref="CreateClientAutomationRuleRequest"/>.
/// </summary>
public class CreateClientAutomationRuleValidator : AutomationRuleBodyValidator<CreateClientAutomationRuleRequest>
{
    /// <summary>
    /// Initializes validation rules for adding a client-only rule.
    /// </summary>
    public CreateClientAutomationRuleValidator()
    {
        RuleFor(x => x.ClientId).NotEmpty();
    }
}
