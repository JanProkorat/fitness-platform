using FitnessPlatform.Application.Features.Automations.Shared;

namespace FitnessPlatform.Application.Features.Automations.GetAutomationRules;

/// <summary>
/// The caller's global automation rules.
/// </summary>
public class GetAutomationRulesResponse
{
    /// <summary>Global rules, oldest first.</summary>
    public List<AutomationRuleDto> Rules { get; set; } = [];

    /// <summary>Always empty: the weekly check-in is an ordinary rule now. Kept so the generated clients keep compiling.</summary>
    public List<AutomationLinkedCheckInDto> LinkedCheckIns { get; set; } = [];
}
