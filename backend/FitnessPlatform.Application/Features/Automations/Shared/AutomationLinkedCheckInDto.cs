using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Automations.Shared;

/// <summary>
/// The weekly check-in of one profession as a linked, read-only entry among the global rules. It names
/// no weekday and no time.
/// </summary>
public class AutomationLinkedCheckInDto
{
    /// <summary>The profession the check-in belongs to.</summary>
    public Profession Profession { get; set; }

    /// <summary>Whether the coach's check-in is enabled.</summary>
    public bool Enabled { get; set; }

    /// <summary>Covered clients with the check-in enabled, after per-client overrides.</summary>
    public int ClientCount { get; set; }
}
