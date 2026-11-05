using FormUp.Application.Features.Automations.Shared;

namespace FormUp.Application.Features.Automations.UpdateAutomationRule;

/// <summary>
/// Request for replacing an automation rule; the body carries the rule and, for a global rule, its audience.
/// </summary>
public class UpdateAutomationRuleRequest : AutomationAudienceBody
{
    /// <summary>Route parameter: public id of the rule.</summary>
    public Guid RuleId { get; set; }
}
