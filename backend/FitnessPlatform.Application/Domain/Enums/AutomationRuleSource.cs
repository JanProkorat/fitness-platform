namespace FitnessPlatform.Application.Domain.Enums;

/// <summary>
/// Where a rule in a client's effective list comes from.
/// </summary>
public enum AutomationRuleSource
{
    /// <summary>The coach's global rule, unchanged for this client.</summary>
    Default = 0,

    /// <summary>The global rule customised for this client.</summary>
    Custom = 1,

    /// <summary>The global rule is paused for this client.</summary>
    Paused = 2,

    /// <summary>A rule that exists only for this client.</summary>
    OnlyThisClient = 3,

    /// <summary>A read-only row linked to another feature (the weekly check-in).</summary>
    Linked = 4,
}
