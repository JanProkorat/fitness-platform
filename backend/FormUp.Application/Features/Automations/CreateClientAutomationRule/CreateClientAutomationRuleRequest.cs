using FormUp.Application.Features.Automations.Shared;

namespace FormUp.Application.Features.Automations.CreateClientAutomationRule;

/// <summary>
/// Request for adding a rule that applies to one client only. It carries no audience.
/// </summary>
public class CreateClientAutomationRuleRequest : AutomationRuleBody
{
    /// <summary>Route parameter: public id of the client profile.</summary>
    public Guid ClientId { get; set; }
}
