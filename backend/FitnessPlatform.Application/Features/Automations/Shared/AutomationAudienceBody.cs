using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Automations.Shared;

/// <summary>
/// A global rule body together with its audience ("Who").
/// </summary>
public class AutomationAudienceBody : AutomationRuleBody
{
    /// <summary>
    /// Which clients the rule applies to. Null means All on create and "leave the audience unchanged"
    /// on update; it must be null for a client-only rule.
    /// </summary>
    public AutomationAudience? Audience { get; set; }

    /// <summary>Public id of the coach's tag; required when the audience is Tag.</summary>
    public Guid? AudienceTagId { get; set; }

    /// <summary>Public ids of the chosen clients; required (non-empty) when the audience is Chosen.</summary>
    public List<Guid> AudienceClientIds { get; set; } = [];
}
