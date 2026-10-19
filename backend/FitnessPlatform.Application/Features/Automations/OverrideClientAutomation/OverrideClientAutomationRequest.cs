using FitnessPlatform.Application.Features.Automations.Shared;

namespace FitnessPlatform.Application.Features.Automations.OverrideClientAutomation;

/// <summary>
/// Request for customising a global rule for one client; the body is the customised message, trigger and options.
/// </summary>
public class OverrideClientAutomationRequest : AutomationTriggerBody
{
    /// <summary>Route parameter: public id of the client profile.</summary>
    public Guid ClientId { get; set; }

    /// <summary>Route parameter: public id of the rule.</summary>
    public Guid RuleId { get; set; }
}
