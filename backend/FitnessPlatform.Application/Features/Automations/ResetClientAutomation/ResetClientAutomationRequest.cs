namespace FitnessPlatform.Application.Features.Automations.ResetClientAutomation;

/// <summary>
/// Request for resetting a global rule to its default for one client.
/// </summary>
public class ResetClientAutomationRequest
{
    /// <summary>Route parameter: public id of the client profile.</summary>
    public Guid ClientId { get; set; }

    /// <summary>Route parameter: public id of the rule.</summary>
    public Guid RuleId { get; set; }
}
