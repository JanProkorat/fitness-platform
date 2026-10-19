namespace FitnessPlatform.Application.Features.Automations.Shared;

/// <summary>
/// The audience tag of a rule.
/// </summary>
public class AutomationRuleTagDto
{
    /// <summary>Public id of the tag.</summary>
    public Guid TagId { get; set; }

    /// <summary>Tag label.</summary>
    public string Name { get; set; } = string.Empty;
}
