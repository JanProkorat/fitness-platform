using FitnessPlatform.Application.Domain.Common;

namespace FitnessPlatform.Application.Domain.Entities;

/// <summary>
/// One chosen client of a <see cref="AutomationRule"/> with a <c>Chosen</c> audience.
/// </summary>
public class AutomationRuleAudienceClient : TimestampableEntity
{
    /// <summary>Foreign key to the rule.</summary>
    public long AutomationRuleId { get; set; }

    /// <summary>Foreign key to the chosen client.</summary>
    public long ClientProfileId { get; set; }

    /// <summary>Navigation to the rule.</summary>
    public AutomationRule AutomationRule { get; set; } = null!;

    /// <summary>Navigation to the client.</summary>
    public ClientProfile ClientProfile { get; set; } = null!;
}
