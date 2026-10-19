namespace FitnessPlatform.Application.Features.Automations.DeleteAutomationRule;

/// <summary>
/// Request for deleting an automation rule.
/// </summary>
public class DeleteAutomationRuleRequest
{
    /// <summary>Route parameter: public id of the rule.</summary>
    public Guid RuleId { get; set; }
}
