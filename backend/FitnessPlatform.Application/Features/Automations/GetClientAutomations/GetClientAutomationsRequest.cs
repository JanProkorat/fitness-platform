namespace FitnessPlatform.Application.Features.Automations.GetClientAutomations;

/// <summary>
/// Request for a client's effective automation rules.
/// </summary>
public class GetClientAutomationsRequest
{
    /// <summary>Route parameter: public id of the client profile.</summary>
    public Guid ClientId { get; set; }
}
