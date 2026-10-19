using FitnessPlatform.Application.Features.Automations.Shared;

namespace FitnessPlatform.Application.Features.Automations.GetAutomationRules;

/// <summary>
/// The caller's global automation rules.
/// </summary>
public class GetAutomationRulesResponse
{
    /// <summary>Global rules, oldest first.</summary>
    public List<AutomationRuleDto> Rules { get; set; } = [];

    /// <summary>The weekly check-in per profession, as a linked read-only entry.</summary>
    public List<AutomationLinkedCheckInDto> LinkedCheckIns { get; set; } = [];
}
