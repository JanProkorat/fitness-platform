namespace FitnessPlatform.Application.Features.Automations.GetAutomationRule;

/// <summary>
/// Request for one automation rule.
/// </summary>
public class GetAutomationRuleRequest
{
    /// <summary>Route parameter: public id of the rule.</summary>
    public Guid RuleId { get; set; }
}
