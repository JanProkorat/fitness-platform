using FitnessPlatform.Application.Features.Automations.Shared;

namespace FitnessPlatform.Application.Features.Automations.CreateAutomationRule;

/// <summary>
/// Validates the <see cref="CreateAutomationRuleRequest"/>; every rule is inherited.
/// </summary>
public class CreateAutomationRuleValidator : AutomationAudienceBodyValidator<CreateAutomationRuleRequest>
{
}
