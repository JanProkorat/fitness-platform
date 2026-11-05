using FormUp.Application.Features.Automations.Shared;

namespace FormUp.Application.Features.Automations.CreateAutomationRule;

/// <summary>
/// Validates the <see cref="CreateAutomationRuleRequest"/>; every rule is inherited.
/// </summary>
public class CreateAutomationRuleValidator : AutomationAudienceBodyValidator<CreateAutomationRuleRequest>
{
}
