using FitnessPlatform.Application.Domain.Enums;

namespace FitnessPlatform.Application.Features.Automations.Shared;

/// <summary>
/// The full body of an automation rule: identity, action and the customisable trigger part.
/// </summary>
public class AutomationRuleBody : AutomationTriggerBody
{
    /// <summary>Rule name (required, at most 100 characters).</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>What the rule asks of the client.</summary>
    public AutomationActionType ActionType { get; set; }

    /// <summary>Questionnaire to send; required for SendForm, ignored otherwise.</summary>
    public Guid? QuestionnaireId { get; set; }
}
