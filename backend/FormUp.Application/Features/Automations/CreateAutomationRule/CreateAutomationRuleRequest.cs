using FormUp.Application.Features.Automations.Shared;

namespace FormUp.Application.Features.Automations.CreateAutomationRule;

/// <summary>
/// Request for creating a global automation rule; the body carries the rule and its audience.
/// </summary>
public class CreateAutomationRuleRequest : AutomationAudienceBody
{
}
