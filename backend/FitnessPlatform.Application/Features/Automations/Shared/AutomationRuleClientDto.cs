namespace FitnessPlatform.Application.Features.Automations.Shared;

/// <summary>
/// A chosen client of a rule's audience.
/// </summary>
public class AutomationRuleClientDto
{
    /// <summary>Public id of the client profile.</summary>
    public Guid ClientId { get; set; }

    /// <summary>Client first name.</summary>
    public string FirstName { get; set; } = string.Empty;

    /// <summary>Client last name.</summary>
    public string LastName { get; set; } = string.Empty;
}
